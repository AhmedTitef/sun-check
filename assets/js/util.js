// Small helpers shared by every page.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

export function fmtPhone(s) {
  const d = digits(s);
  if (d.length !== 10) return s || '';
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function validPhone(s) { return digits(s).length === 10; }

const DAY = 86400000;
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
}
export function fmtDay(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtWhen(d) {
  const when = new Date(d);
  const diff = daysBetween(new Date(), when);
  const time = fmtTime(when);
  if (diff === 0) return `today at ${time}`;
  if (diff === 1) return `tomorrow at ${time}`;
  if (diff > 1 && diff < 7) return `${when.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
  return `${fmtDay(when)} at ${time}`;
}
export function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// One-tap text from the rep's own phone. iOS wants "&body=", everyone else "?body=".
export function smsHref(number, body) {
  const n = digits(number);
  const to = n ? `+1${n}` : '';
  return `sms:${to}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const ok = await copyText(url ? `${text} ${url}` : text);
  return ok ? 'copied' : 'failed';
}

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

let toastTimer;
export function toast(msg, action) {
  $$('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); el.remove(); });
    el.appendChild(b);
  }
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), action ? 5200 : 2600);
}

// Bottom sheet. Returns { el, close }. Content is built by the caller.
export function sheet({ title, body, onClose }) {
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grab" aria-hidden="true"></div>
    <div class="sheet-head"><h2>${esc(title)}</h2>
      <button class="iconbtn" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="sheet-body"></div></div>`;
  const bodyEl = scrim.querySelector('.sheet-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(scrim);
  const first = scrim.querySelector('[autofocus]') || scrim.querySelector('.sheet');
  first && first.focus && setTimeout(() => first.focus(), 30);
  return { el: scrim.querySelector('.sheet'), body: bodyEl, close };
}

// The customer page link, personalized by the rep's own settings. Everything
// personal rides in the #fragment, which browsers never send to any server:
// the rep's name, number and Google Form, plus any prefill for one person.
export const SITE_ROOT = new URL('../../', import.meta.url).href;

export function pageLink(settings, extra = {}) {
  const p = new URLSearchParams();
  if (settings.first) p.set('r', settings.first.trim());
  if (digits(settings.phone).length === 10) p.set('p', digits(settings.phone));
  const form = parseForm(settings.form);
  // Entry ids go in base 36 to keep the QR code small enough to scan from a meter away.
  if (form) { p.set('f', form.id); p.set('e', form.entries.map(n => Number(n).toString(36)).join('.')); }
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const q = p.toString();
  return SITE_ROOT + (q ? `#${q}` : '');
}

// The rep pastes her Google Form's pre-filled link, with the three answers
// typed as NAME, PHONE and DETAILS. We keep the form id and the entry ids.
export function parseForm(link) {
  if (!link) return null;
  const m = String(link).match(/\/forms\/d\/e\/([A-Za-z0-9_-]{20,})\//);
  if (!m) return null;
  const ids = {};
  const order = [];
  for (const [, id, val] of String(link).matchAll(/entry\.(\d+)=([^&#]*)/g)) {
    const v = decodeURIComponent(val.replace(/\+/g, ' ')).trim().toUpperCase();
    order.push(id);
    if (['NAME', 'PHONE', 'DETAILS'].includes(v)) ids[v] = id;
  }
  const entries = ids.NAME && ids.PHONE && ids.DETAILS ? [ids.NAME, ids.PHONE, ids.DETAILS] : order.length === 3 ? order : null;
  return entries ? { id: m[1], entries } : null;
}

// Read the fragment the page was opened with.
export function readFragment(hash = location.hash) {
  const p = new URLSearchParams(String(hash).replace(/^#/, ''));
  return Object.fromEntries(p.entries());
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export const ICONS = {
  sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>',
};
