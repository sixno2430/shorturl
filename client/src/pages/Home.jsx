import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { LinkRow, ResultCard } from '../components.jsx';

export default function Home() {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);

  const loadRecent = () =>
    api.list({ limit: 5 }).then((d) => setRecent(d.items)).catch(() => {});

  useEffect(() => {
    loadRecent();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const link = await api.create({
        url,
        alias: alias || undefined,
        title: title || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setResult(link);
      setUrl('');
      setAlias('');
      setTitle('');
      setExpiresAt('');
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="hero">
        <h1>ย่อลิงก์ยาวให้สั้น<br />แชร์ง่าย สแกนได้ วัดผลได้</h1>
        <p className="muted">วาง URL แล้วรับ Short URL พร้อม QR Code และสถิติการคลิก</p>
      </section>

      <form className="card form" onSubmit={submit}>
        <div className="input-row">
          <label className="sr-only" htmlFor="url">URL ที่ต้องการย่อ</label>
          <input
            id="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.example.com/very/long/link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'กำลังสร้าง…' : 'ย่อลิงก์'}
          </button>
        </div>

        <button type="button" className="link-btn" onClick={() => setShowOptions((v) => !v)}
          aria-expanded={showOptions}>
          {showOptions ? '− ซ่อนตัวเลือก' : '+ ตัวเลือกเพิ่มเติม (ตั้งชื่อลิงก์เอง, วันหมดอายุ)'}
        </button>

        {showOptions && (
          <div className="options">
            <label>
              <span>ชื่อลิงก์ (custom alias)</span>
              <div className="prefix-input">
                <span className="mono muted">{window.location.host}/</span>
                <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="my-link"
                  pattern="[A-Za-z0-9_\-]{3,32}" title="a-z, 0-9, - หรือ _ ยาว 3–32 ตัว" />
              </div>
            </label>
            <label>
              <span>ชื่อเรียก (ไม่บังคับ)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น โปรโมชันเดือนตุลา" maxLength={255} />
            </label>
            <label>
              <span>วันหมดอายุ (ไม่บังคับ)</span>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {result && <ResultCard link={result} />}

      <section className="recent">
        <div className="section-head">
          <h2>ลิงก์ล่าสุด</h2>
          <Link to="/history">ดูทั้งหมด →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">ยังไม่มีลิงก์ ลองสร้างลิงก์แรกด้านบน</p>
        ) : (
          <ul className="link-list card">
            {recent.map((l) => <LinkRow key={l.id} link={l} />)}
          </ul>
        )}
      </section>
    </>
  );
}
