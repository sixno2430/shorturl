import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';
import { UAParser } from 'ua-parser-js';
import { query } from './db.js';
import { validateTargetUrl, validateAlias, validateExpiry, RESERVED_CODES } from './validate.js';

const generateCode = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  7,
);

function baseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function toDto(row, req) {
  const now = Date.now();
  return {
    id: Number(row.id),
    code: row.short_code,
    shortUrl: `${baseUrl(req)}/${row.short_code}`,
    originalUrl: row.original_url,
    title: row.title,
    isCustom: row.is_custom,
    clicks: Number(row.click_count),
    expiresAt: row.expires_at,
    isExpired: row.expires_at ? new Date(row.expires_at).getTime() <= now : false,
    createdAt: row.created_at,
  };
}

function statusPage(res, status, heading, message) {
  res.status(status).type('html').send(`<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f5f2;color:#1d1d1b}
main{text-align:center;padding:24px}h1{font-size:56px;margin:0}p{color:#5f5e5a}a{color:#c8102e}</style></head>
<body><main><h1>${status}</h1><p><strong>${heading}</strong></p><p>${message}</p><p><a href="/">กลับหน้าแรก</a></p></main></body></html>`);
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.CREATE_RATE_LIMIT || 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'สร้างลิงก์ถี่เกินไป กรุณารอสักครู่' },
  });

  // ---------- API ----------
  const api = express.Router();

  api.get('/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ ok: true });
  });

  // Create a short URL
  api.post('/urls', createLimiter, async (req, res) => {
    const { url, alias, expiresAt, title } = req.body || {};

    const target = validateTargetUrl(url, req.get('host'));
    if (!target.ok) return res.status(400).json({ error: target.error });
    const a = validateAlias(alias);
    if (!a.ok) return res.status(400).json({ error: a.error });
    const exp = validateExpiry(expiresAt);
    if (!exp.ok) return res.status(400).json({ error: exp.error });
    const cleanTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 255) : null;

    const insert = (code, isCustom) =>
      query(
        `INSERT INTO urls (short_code, original_url, title, is_custom, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [code, target.url, cleanTitle, isCustom, exp.expiresAt],
      );

    try {
      if (a.alias) {
        const { rows } = await insert(a.alias, true);
        return res.status(201).json(toDto(rows[0], req));
      }
      // Random code: retry on the (rare) collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { rows } = await insert(generateCode(), false);
          return res.status(201).json(toDto(rows[0], req));
        } catch (err) {
          if (err.code !== '23505') throw err;
        }
      }
      return res.status(500).json({ error: 'สร้างรหัสไม่สำเร็จ กรุณาลองใหม่' });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'ชื่อลิงก์นี้ถูกใช้แล้ว' });
      throw err;
    }
  });

  // History list with search + pagination
  api.get('/urls', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sort = req.query.sort === 'clicks' ? 'click_count DESC, created_at DESC' : 'created_at DESC';

    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = 'WHERE original_url ILIKE $1 OR short_code ILIKE $1 OR title ILIKE $1';
    }
    const total = await query(`SELECT COUNT(*)::int AS n FROM urls ${where}`, params);
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(
      `SELECT * FROM urls ${where} ORDER BY ${sort}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const summary = await query(
      'SELECT COUNT(*)::int AS links, COALESCE(SUM(click_count),0)::int AS clicks FROM urls',
    );
    res.json({
      items: rows.map((r) => toDto(r, req)),
      total: total.rows[0].n,
      page,
      limit,
      summary: summary.rows[0],
    });
  });

  async function findByCode(code) {
    const { rows } = await query('SELECT * FROM urls WHERE short_code = $1', [code]);
    return rows[0];
  }

  api.get('/urls/:code', async (req, res) => {
    const row = await findByCode(req.params.code);
    if (!row) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    res.json(toDto(row, req));
  });

  api.delete('/urls/:code', async (req, res) => {
    const { rowCount } = await query('DELETE FROM urls WHERE short_code = $1', [req.params.code]);
    if (!rowCount) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    res.status(204).end();
  });

  // QR code (PNG or SVG). The QR points at ?src=qr so scans are counted separately.
  api.get('/urls/:code/qr', async (req, res) => {
    const row = await findByCode(req.params.code);
    if (!row) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    const target = `${baseUrl(req)}/${row.short_code}?src=qr`;
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 320, 128), 1024);
    const opts = { margin: 2, width: size, errorCorrectionLevel: 'M' };

    if (req.query.format === 'svg') {
      return res.type('image/svg+xml').send(await QRCode.toString(target, { ...opts, type: 'svg' }));
    }
    const png = await QRCode.toBuffer(target, opts);
    if (req.query.download) {
      res.set('Content-Disposition', `attachment; filename="qr-${row.short_code}.png"`);
    }
    res.type('png').send(png);
  });

  // Click statistics
  api.get('/urls/:code/stats', async (req, res) => {
    const row = await findByCode(req.params.code);
    if (!row) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const tz = typeof req.query.tz === 'string' && /^[A-Za-z_/+-]{1,64}$/.test(req.query.tz)
      ? req.query.tz : 'Asia/Bangkok';

    const [daily, device, browser, os, source, referrer, recent] = await Promise.all([
      query(
        `WITH d AS (
           SELECT generate_series(
             (NOW() AT TIME ZONE $2)::date - ($3::int - 1), (NOW() AT TIME ZONE $2)::date, '1 day'
           )::date AS day)
         SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(c.id)::int AS clicks
         FROM d LEFT JOIN clicks c
           ON c.url_id = $1 AND (c.clicked_at AT TIME ZONE $2)::date = d.day
         GROUP BY d.day ORDER BY d.day`,
        [row.id, tz, days],
      ),
      groupBy(row.id, 'device'),
      groupBy(row.id, 'browser'),
      groupBy(row.id, 'os'),
      groupBy(row.id, 'source'),
      query(
        `SELECT COALESCE(NULLIF(substring(referrer from '^[a-z]+://([^/:]+)'), ''), 'Direct') AS name,
                COUNT(*)::int AS value
         FROM clicks WHERE url_id = $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
        [row.id],
      ),
      query(
        `SELECT clicked_at, source, browser, os, device, referrer
         FROM clicks WHERE url_id = $1 ORDER BY clicked_at DESC LIMIT 20`,
        [row.id],
      ),
    ]);

    const lastClick = recent.rows[0]?.clicked_at || null;
    res.json({
      url: toDto(row, req),
      totalClicks: Number(row.click_count),
      lastClick,
      daily: daily.rows,
      byDevice: device.rows,
      byBrowser: browser.rows,
      byOs: os.rows,
      bySource: source.rows,
      byReferrer: referrer.rows,
      recent: recent.rows,
    });
  });

  function groupBy(urlId, column) {
    // column comes from a fixed list above, never from user input
    return query(
      `SELECT COALESCE(${column}, 'Unknown') AS name, COUNT(*)::int AS value
       FROM clicks WHERE url_id = $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      [urlId],
    );
  }

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // ---------- Frontend (built React app) ----------
  const clientDist = process.env.CLIENT_DIST || path.resolve(process.cwd(), '../client/dist');
  const hasClient = fs.existsSync(path.join(clientDist, 'index.html'));
  if (hasClient) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  }
  const sendIndex = (_req, res) =>
    hasClient
      ? res.sendFile(path.join(clientDist, 'index.html'))
      : res.type('text').send('Frontend not built. Run `npm run build` in /client.');
  app.get(['/', '/history', '/stats/:code'], sendIndex);

  // ---------- Redirect ----------
  app.get('/:code', async (req, res) => {
    const { code } = req.params;
    if (RESERVED_CODES.has(code.toLowerCase())) return statusPage(res, 404, 'ไม่พบหน้า', '');

    const row = await findByCode(code);
    if (!row) return statusPage(res, 404, 'ไม่พบลิงก์นี้', 'ลิงก์อาจถูกลบหรือพิมพ์ผิด');
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return statusPage(res, 410, 'ลิงก์หมดอายุแล้ว', 'เจ้าของลิงก์ตั้งวันหมดอายุไว้');
    }

    // 302 + no-store so every visit reaches the server and is counted.
    res.set('Cache-Control', 'no-store');
    res.redirect(302, row.original_url);

    recordClick(row.id, req).catch((err) => console.error('recordClick failed', err));
  });

  // ---------- Errors ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
  });

  return app;
}

async function recordClick(urlId, req) {
  const ua = req.get('user-agent') || '';
  const parsed = new UAParser(ua).getResult();
  const device = parsed.device.type === 'mobile' || parsed.device.type === 'tablet'
    ? parsed.device.type
    : /bot|crawl|spider|preview/i.test(ua) ? 'bot' : 'desktop';
  const salt = process.env.IP_HASH_SALT || 'shorturl';
  const ipHash = crypto.createHash('sha256').update(`${salt}:${req.ip}`).digest('hex');
  const source = req.query.src === 'qr' ? 'qr' : 'link';

  await query(
    `WITH ins AS (
       INSERT INTO clicks (url_id, source, referrer, user_agent, browser, os, device, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8))
     UPDATE urls SET click_count = click_count + 1 WHERE id = $1`,
    [
      urlId,
      source,
      req.get('referer') || null,
      ua.slice(0, 1000) || null,
      parsed.browser.name || null,
      parsed.os.name || null,
      device,
      ipHash,
    ],
  );
}
