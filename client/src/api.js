async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  return data;
}

export const api = {
  create: (body) => request('/urls', { method: 'POST', body: JSON.stringify(body) }),
  list: (params = {}) => request(`/urls?${new URLSearchParams(params)}`),
  get: (code) => request(`/urls/${encodeURIComponent(code)}`),
  stats: (code, days = 30) =>
    request(
      `/urls/${encodeURIComponent(code)}/stats?days=${days}&tz=${encodeURIComponent(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )}`,
    ),
  remove: (code) => request(`/urls/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  qrUrl: (code, opts = {}) =>
    `/api/urls/${encodeURIComponent(code)}/qr?${new URLSearchParams(opts)}`,
};

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
