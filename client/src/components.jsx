import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, hostOf } from './api.js';

export function CopyButton({ text, className = 'btn btn-ghost' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
    </button>
  );
}

export function ResultCard({ link }) {
  return (
    <section className="card result" aria-live="polite">
      <div className="result-main">
        <p className="eyebrow">ลิงก์ของคุณพร้อมแล้ว</p>
        <a className="short-link" href={link.shortUrl} target="_blank" rel="noreferrer">
          {link.shortUrl.replace(/^https?:\/\//, '')}
        </a>
        <p className="target" title={link.originalUrl}>→ {link.originalUrl}</p>
        <div className="row-actions">
          <CopyButton text={link.shortUrl} className="btn btn-primary" />
          <a className="btn btn-ghost" href={link.shortUrl} target="_blank" rel="noreferrer">เปิดลิงก์</a>
          <Link className="btn btn-ghost" to={`/stats/${link.code}`}>ดูสถิติ</Link>
        </div>
        {link.expiresAt && (
          <p className="muted small">หมดอายุ {formatDate(link.expiresAt)}</p>
        )}
      </div>
      <div className="qr-box">
        <img src={api.qrUrl(link.code, { size: 360 })} alt={`QR Code ของ ${link.shortUrl}`} width="168" height="168" />
        <a className="btn btn-ghost small" href={api.qrUrl(link.code, { size: 1024, download: 1 })}>
          ดาวน์โหลด QR
        </a>
      </div>
    </section>
  );
}

export function LinkRow({ link, onDelete }) {
  return (
    <li className="link-row">
      <img className="favicon" alt="" width="20" height="20"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        src={`https://www.google.com/s2/favicons?sz=64&domain=${hostOf(link.originalUrl)}`} />
      <div className="link-text">
        <div className="link-top">
          <a href={link.shortUrl} target="_blank" rel="noreferrer" className="mono">/{link.code}</a>
          {link.isCustom && <span className="tag">custom</span>}
          {link.isExpired && <span className="tag tag-warn">หมดอายุ</span>}
        </div>
        <p className="target" title={link.originalUrl}>{link.title || link.originalUrl}</p>
        <p className="muted small">{formatDate(link.createdAt)}</p>
      </div>
      <Link to={`/stats/${link.code}`} className="clicks" title="ดูสถิติ">
        <strong>{link.clicks.toLocaleString('th-TH')}</strong>
        <span>คลิก</span>
      </Link>
      <div className="row-actions compact">
        <CopyButton text={link.shortUrl} />
        {onDelete && (
          <button type="button" className="btn btn-ghost danger" onClick={() => onDelete(link)}>
            ลบ
          </button>
        )}
      </div>
    </li>
  );
}
