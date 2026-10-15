import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import History from './pages/History.jsx';
// Stats pulls in the chart library, so load it only when needed.
const Stats = lazy(() => import('./pages/Stats.jsx'));

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M7 13l5-5m-3 9l7-7m-2 8l5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            </svg>
          </span>
          Snip
        </Link>
        <nav className="nav">
          <NavLink to="/" end>สร้างลิงก์</NavLink>
          <NavLink to="/history">ประวัติ</NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats/:code" element={<Suspense fallback={<p className="muted">กำลังโหลด…</p>}><Stats /></Suspense>} />
          <Route path="*" element={<p className="muted">ไม่พบหน้านี้</p>} />
        </Routes>
      </main>

      <footer className="footer">Short URL · React + Express + PostgreSQL</footer>
    </div>
  );
}
