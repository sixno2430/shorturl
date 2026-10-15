import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { LinkRow } from '../components.jsx';

const LIMIT = 20;

export default function History() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const load = () =>
    api
      .list({ search: query, sort, page, limit: LIMIT })
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const remove = async (link) => {
    if (!window.confirm(`ลบลิงก์ /${link.code} และสถิติทั้งหมด?`)) return;
    try {
      await api.remove(link.code);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <>
      <div className="page-head">
        <h1>ประวัติการสร้างลิงก์</h1>
        {data && (
          <div className="kpis">
            <div className="kpi"><strong>{data.summary.links.toLocaleString('th-TH')}</strong><span>ลิงก์ทั้งหมด</span></div>
            <div className="kpi"><strong>{data.summary.clicks.toLocaleString('th-TH')}</strong><span>คลิกทั้งหมด</span></div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <input type="search" placeholder="ค้นหา URL, รหัส หรือชื่อเรียก" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="ค้นหา" />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="เรียงลำดับ">
          <option value="recent">ล่าสุดก่อน</option>
          <option value="clicks">คลิกมากสุด</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="muted">กำลังโหลด…</p>
      ) : data.items.length === 0 ? (
        <p className="muted">ไม่พบลิงก์</p>
      ) : (
        <ul className="link-list card">
          {data.items.map((l) => <LinkRow key={l.id} link={l} onDelete={remove} />)}
        </ul>
      )}

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button>
          <span className="muted">หน้า {page} / {pages}</span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป →</button>
        </div>
      )}
    </>
  );
}
