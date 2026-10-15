// Paths the app itself uses; a custom alias may not take them.
export const RESERVED_CODES = new Set([
  'api', 'assets', 'history', 'stats', 'health', 'favicon.ico', 'robots.txt', 'index.html',
]);

const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;

/**
 * Normalise and validate a URL the user wants to shorten.
 * Returns { ok: true, url } or { ok: false, error }.
 */
export function validateTargetUrl(input, ownHost) {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'กรุณากรอก URL' };
  }
  let raw = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  if (raw.length > 2048) return { ok: false, error: 'URL ยาวเกิน 2048 ตัวอักษร' };

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'รูปแบบ URL ไม่ถูกต้อง' };
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    return { ok: false, error: 'รองรับเฉพาะ http และ https' };
  }
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') {
    return { ok: false, error: 'โดเมนไม่ถูกต้อง' };
  }
  if (ownHost && u.host.toLowerCase() === ownHost.toLowerCase()) {
    return { ok: false, error: 'ไม่สามารถย่อลิงก์ของระบบนี้ซ้ำได้' };
  }
  return { ok: true, url: u.toString() };
}

export function validateAlias(alias) {
  if (alias === undefined || alias === null || alias === '') return { ok: true, alias: null };
  if (typeof alias !== 'string' || !ALIAS_RE.test(alias)) {
    return { ok: false, error: 'ชื่อลิงก์ต้องเป็น a-z, A-Z, 0-9, - หรือ _ ยาว 3–32 ตัว' };
  }
  if (RESERVED_CODES.has(alias.toLowerCase())) {
    return { ok: false, error: 'ชื่อนี้ถูกสงวนไว้โดยระบบ' };
  }
  return { ok: true, alias };
}

export function validateExpiry(value) {
  if (value === undefined || value === null || value === '') return { ok: true, expiresAt: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'วันหมดอายุไม่ถูกต้อง' };
  if (d.getTime() <= Date.now()) return { ok: false, error: 'วันหมดอายุต้องเป็นเวลาในอนาคต' };
  return { ok: true, expiresAt: d };
}
