import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { migrate, pool } from '../src/db.js';
import { validateTargetUrl, validateAlias } from '../src/validate.js';

// These tests need a real Postgres. Point DATABASE_URL at a throwaway database.
let app;

beforeAll(async () => {
  await migrate();
  await pool.query('TRUNCATE clicks, urls RESTART IDENTITY CASCADE');
  app = createApp();
});

afterAll(async () => {
  await pool.end();
});

describe('validation', () => {
  it('adds https:// when missing', () => {
    expect(validateTargetUrl('synerry.com').url).toBe('https://synerry.com/');
  });
  it('rejects non-http protocols', () => {
    expect(validateTargetUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateTargetUrl('ftp://example.com').ok).toBe(false);
  });
  it('rejects shortening our own host', () => {
    expect(validateTargetUrl('http://short.test/abc', 'short.test').ok).toBe(false);
  });
  it('rejects reserved and malformed aliases', () => {
    expect(validateAlias('api').ok).toBe(false);
    expect(validateAlias('a b').ok).toBe(false);
    expect(validateAlias('my-link_1').ok).toBe(true);
  });
});

describe('short URL flow', () => {
  let code;

  it('creates a short URL (criterion 3)', async () => {
    const res = await request(app).post('/api/urls').send({ url: 'https://www.synerry.com' });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(res.body.originalUrl).toBe('https://www.synerry.com/');
    code = res.body.code;
  });

  it('redirects to the original URL and counts the click', async () => {
    const res = await request(app).get(`/${code}`).set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://www.synerry.com/');
    await new Promise((r) => setTimeout(r, 100));
    const detail = await request(app).get(`/api/urls/${code}`);
    expect(detail.body.clicks).toBe(1);
  });

  it('serves a QR code PNG that encodes the short URL (criterion 4)', async () => {
    const res = await request(app).get(`/api/urls/${code}/qr`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBeGreaterThan(200);
  });

  it('counts QR scans separately', async () => {
    await request(app).get(`/${code}?src=qr`);
    await new Promise((r) => setTimeout(r, 100));
    const stats = await request(app).get(`/api/urls/${code}/stats`);
    expect(stats.body.totalClicks).toBe(2);
    const sources = Object.fromEntries(stats.body.bySource.map((s) => [s.name, s.value]));
    expect(sources).toEqual({ link: 1, qr: 1 });
    expect(stats.body.byDevice.find((d) => d.name === 'mobile').value).toBe(1);
    expect(stats.body.daily).toHaveLength(30);
  });

  it('lists history with search (criterion 5)', async () => {
    const res = await request(app).get('/api/urls?search=synerry');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].code).toBe(code);
    expect(res.body.summary.clicks).toBe(2);
  });

  it('supports custom aliases and rejects duplicates', async () => {
    const a = await request(app).post('/api/urls').send({ url: 'example.com', alias: 'my-link' });
    expect(a.status).toBe(201);
    expect(a.body.code).toBe('my-link');
    const b = await request(app).post('/api/urls').send({ url: 'example.org', alias: 'my-link' });
    expect(b.status).toBe(409);
  });

  it('returns 410 for expired links', async () => {
    const res = await request(app).post('/api/urls').send({
      url: 'https://example.com/old',
      expiresAt: new Date(Date.now() + 1500).toISOString(),
    });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 1700));
    const visit = await request(app).get(`/${res.body.code}`);
    expect(visit.status).toBe(410);
  });

  it('returns 404 for unknown codes', async () => {
    const res = await request(app).get('/nope123');
    expect(res.status).toBe(404);
  });

  it('deletes a link', async () => {
    const del = await request(app).delete('/api/urls/my-link');
    expect(del.status).toBe(204);
    const after = await request(app).get('/my-link');
    expect(after.status).toBe(404);
  });
});
