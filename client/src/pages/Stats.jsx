import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, formatDate } from '../api.js';
import { CopyButton } from '../components.jsx';

const RANGES = [7, 30, 90];
const LABELS = { link: 'คลิกลิงก์', qr: 'สแกน QR', mobile: 'มือถือ', desktop: 'คอมพิวเตอร์', tablet: 'แท็บเล็ต', bot: 'บอท' };

function Breakdown({ title, rows }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <section className="card breakdown">
      <h3>{title}</h3>
      {total === 0 ? (
        <p className="muted small">ยังไม่มีข้อมูล</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.name}>
              <div className="bd-label">
                <span>{LABELS[r.name] || r.name}</span>
                <span className="muted">{r.value} · {Math.round((r.value / total) * 100)}%</span>
              </div>
              <div className="bd-track"><div className="bd-fill" style={{ width: `${(r.value / total) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Stats() {
  const { code } = useParams();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.stats(code, days).then(setData).catch((e) => setError(e.message));
  }, [code, days]);

  if (error) return (<><p className="error">{error}</p><Link to="/history">← กลับไปหน้าประวัติ</Link></>);
  if (!data) return <p className="muted">กำลังโหลด…</p>;

  const { url } = data;
  const qrCount = data.bySource.find((s) => s.name === 'qr')?.value || 0;
  const chartData = data.daily.map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
  }));
  const rangeClicks = data.daily.reduce((s, d) => s + d.clicks, 0);

  return (
    <>
      <Link to="/history" className="back">← ประวัติ</Link>

      <section className="card stats-head">
        <div className="result-main">
          <p className="eyebrow">{url.title || 'สถิติลิงก์'}</p>
          <a className="short-link" href={url.shortUrl} target="_blank" rel="noreferrer">
            {url.shortUrl.replace(/^https?:\/\//, '')}
          </a>
          <p className="target" title={url.originalUrl}>→ {url.originalUrl}</p>
          <div className="row-actions">
            <CopyButton text={url.shortUrl} className="btn btn-primary" />
            <a className="btn btn-ghost" href={api.qrUrl(url.code, { size: 1024, download: 1 })}>ดาวน์โหลด QR</a>
          </div>
          <p className="muted small">
            สร้างเมื่อ {formatDate(url.createdAt)}
            {url.expiresAt && <> · {url.isExpired ? 'หมดอายุแล้วเมื่อ' : 'หมดอายุ'} {formatDate(url.expiresAt)}</>}
          </p>
        </div>
        <div className="qr-box">
          <img src={api.qrUrl(url.code, { size: 360 })} alt="QR Code" width="148" height="148" />
        </div>
      </section>

      <div className="kpis kpis-4">
        <div className="kpi card"><strong>{data.totalClicks.toLocaleString('th-TH')}</strong><span>คลิกทั้งหมด</span></div>
        <div className="kpi card"><strong>{rangeClicks.toLocaleString('th-TH')}</strong><span>ใน {days} วันล่าสุด</span></div>
        <div className="kpi card"><strong>{qrCount.toLocaleString('th-TH')}</strong><span>มาจากการสแกน QR</span></div>
        <div className="kpi card"><strong className="kpi-small">{data.lastClick ? formatDate(data.lastClick) : '—'}</strong><span>คลิกล่าสุด</span></div>
      </div>

      <section className="card chart-card">
        <div className="section-head">
          <h3>คลิกรายวัน</h3>
          <div className="segmented" role="group" aria-label="ช่วงเวลา">
            {RANGES.map((r) => (
              <button key={r} type="button" className={r === days ? 'active' : ''} onClick={() => setDays(r)}>
                {r} วัน
              </button>
            ))}
          </div>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} className="chart-grid" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd"
                tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={16} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'var(--hover)' }} formatter={(v) => [v, 'คลิก']}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)' }} />
              <Bar dataKey="clicks" className="chart-bar" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid-2">
        <Breakdown title="ช่องทาง" rows={data.bySource} />
        <Breakdown title="อุปกรณ์" rows={data.byDevice} />
        <Breakdown title="เบราว์เซอร์" rows={data.byBrowser} />
        <Breakdown title="แหล่งที่มา (Referrer)" rows={data.byReferrer} />
      </div>

      <section className="card">
        <h3>การคลิกล่าสุด</h3>
        {data.recent.length === 0 ? (
          <p className="muted small">ยังไม่มีการคลิก ลองเปิดลิงก์หรือสแกน QR ดู</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>เวลา</th><th>ช่องทาง</th><th>อุปกรณ์</th><th>เบราว์เซอร์ / OS</th></tr></thead>
              <tbody>
                {data.recent.map((c, i) => (
                  <tr key={i}>
                    <td>{formatDate(c.clicked_at)}</td>
                    <td>{LABELS[c.source] || c.source}</td>
                    <td>{LABELS[c.device] || c.device || '—'}</td>
                    <td>{[c.browser, c.os].filter(Boolean).join(' / ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
