// Sun Check: the shopper's own-phone page. Address, their roof from above with the
// sun sweeping over it, a rough estimate, then the times that suit them. The request
// goes straight to the rep's own Google Form; nothing is stored anywhere else.

import { $, $$, esc, digits, fmtPhone, validPhone, readFragment, copyText, shareOrCopy, download, toast, sheet, SITE_ROOT } from './util.js';
import { pickLang, makeT } from './i18n.js';
import { suggest, geocode, reverse, utilityAt, footprints, pickFootprint, sunAt, unproject, metersPerPx, layoutPanels, choosePanels, slopesFor, dirFactor, makeView, tilesFor, frontBearing, bearingTo, project } from './roof.js';
import { estimate, utilityKey, UTILITIES } from './estimate.js';
import { readBill } from './bill.js';

/* ---------- who sent this link ---------- */
const frag = readFragment();
const rep = {
  first: (frag.r || '').slice(0, 24),
  phone: digits(frag.p || ''),
  form: frag.f ? { id: frag.f, entries: String(frag.e || '').split('.').map(x => parseInt(x, 36)).filter(Number.isFinite) } : null,
};
const live = Boolean(rep.form && rep.form.id && rep.form.entries.length === 3);
const prefill = { first: frag.n || '', address: frag.a || '' };
// Keep one person's prefill out of the address bar so it can't be shared by accident.
if (frag.n || frag.a) {
  const keep = new URLSearchParams();
  for (const k of ['r', 'p', 'f', 'e', 's', 'ref', 'st']) if (frag[k]) keep.set(k, frag[k]);
  history.replaceState(null, '', `${location.pathname}${location.search}${keep.toString() ? `#${keep}` : ''}`);
}
const repLink = extra => {
  const p = new URLSearchParams();
  for (const k of ['r', 'p', 'f', 'e']) if (frag[k]) p.set(k, frag[k]);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return `${SITE_ROOT}#${p}`;
};

/* ---------- language ---------- */
let lang = pickLang();
let t = makeT(lang);
const repName = () => rep.first || t('yourRep');
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const dirKey = b => DIR8[Math.round((((b % 360) + 360) % 360) / 45) % 8];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const num = n => Number(n).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US');
const clock = d => d.toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit' });

const STATIC = {
  't-title1': 'title1', 't-sub1': 'sub1', 't-street': 'street', 't-zip': 'zip', 't-show': 'show', 't-locate': 'locate',
  next1: 'next1', 't-title2': 'title2', 't-bill': 'bill', 't-own': 'own', 't-snap': 'snap', 't-snapnote': 'snapNote',
  't-how': 'how', 't-howtext': 'howText', next2: 'next2', 't-title3': 'title3', 't-meet': 'meetQ', 't-partner': 'partner',
  't-name': 'name', 't-phone': 'phone', 't-email': 'email', privacy: 'privacy', 't-back2': 'back', 't-back3': 'back',
};

function applyText() {
  document.documentElement.lang = lang;
  for (const [id, key] of Object.entries(STATIC)) { const el = document.getElementById(id); if (el) el.textContent = t(key); }
  $$('.lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const ribbon = $('#ribbon');
  ribbon.hidden = live;
  if (!live) ribbon.innerHTML = t('ribbon');
  const w = $('#with');
  w.hidden = !rep.first;
  if (rep.first) w.textContent = t('withRep', { rep: rep.first });
  const ctx = $('#context');
  const line = frag.ref ? t('refLine', { ref: frag.ref.slice(0, 24) }) : frag.st ? t('streetLine', { st: frag.st.slice(0, 40) }) : '';
  ctx.hidden = !line;
  ctx.textContent = line;
  $('#t-sub3').textContent = t('sub3', { rep: repName() });
  renderFacing(); renderPlace(); renderNeighbors(); renderTradeoff(); renderNumbers(); renderTimes();
  if (!$('#s4').hidden) renderDone();
}

$('.lang').addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === lang) return;
  lang = b.dataset.lang;
  t = makeT(lang);
  try { localStorage.setItem('suncheck.lang', lang); } catch (err) { /* ignore */ }
  applyText();
});

/* ---------- state ---------- */
const S = {
  geo: null, layout: null, view: null, base: null, tiles: null,
  utilKey: 'sce', utilName: '', zip: '',
  frontAuto: null, front: null, faceUnsure: false,
  place: null,
  sun: null, est: null, panels: [],
  bill: 250, own: true, billRead: null,
  prefs: new Set(), meet: 'either', busy: false, animating: false, sentAt: null,
};

/* ---------- screens ---------- */
function go(n) {
  for (const i of [1, 2, 3, 4]) $(`#s${i}`).hidden = i !== n;
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/* ---------- address ---------- */
const street = $('#street'), zipIn = $('#zipc'), list = $('#suggest'), err = $('#addr-err');
let sugTimer = null, sugSeq = 0;
street.addEventListener('input', () => {
  clearTimeout(sugTimer);
  const q = `${street.value} ${zipIn.value}`.trim();
  if (q.length < 6) { list.hidden = true; return; }
  sugTimer = setTimeout(async () => {
    const mine = ++sugSeq;
    try {
      const items = await suggest(q);
      if (mine !== sugSeq || S.busy || document.activeElement !== street) return;
      list.innerHTML = items.map((s, i) => `<li role="option"><button type="button" data-i="${i}">${esc(s.text)}</button></li>`).join('');
      list.hidden = !items.length;
      list._items = items;
    } catch (e) { list.hidden = true; }
  }, 260);
});
list.addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const s = list._items[Number(b.dataset.i)];
  street.value = s.text.split(',')[0];
  const z = s.text.match(/\b(\d{5})\b(?!.*\d{5})/);
  if (z) zipIn.value = z[1];
  list.hidden = true;
  lookup(s.text, s.magicKey);
});
document.addEventListener('click', e => { if (!e.target.closest('.addr')) list.hidden = true; });

$('#addr').addEventListener('submit', e => {
  e.preventDefault();
  list.hidden = true;
  const s = street.value.trim(), z = zipIn.value.trim();
  if (!s) { err.textContent = t('notFound'); street.focus(); return; }
  lookup(`${s}${z ? `, ${z}` : ''}`);
});

$('#locate').addEventListener('click', () => {
  err.textContent = '';
  if (!navigator.geolocation) { err.textContent = t('locError'); return; }
  const label = $('#t-locate');
  label.textContent = t('locating');
  navigator.geolocation.getCurrentPosition(async pos => {
    label.textContent = t('locate');
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const r = await reverse(lat, lon);
      if (r) { street.value = r.street || ''; zipIn.value = r.zip || ''; }
      showRoof({ address: r ? r.address : '', street: r ? r.street : '', zip: r ? r.zip : '', city: r ? r.city : '', lat, lon, exact: true });
    } catch (e) { showRoof({ address: '', street: '', zip: '', lat, lon, exact: true }); }
  }, () => { label.textContent = t('locate'); err.textContent = t('locError'); }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
});

async function lookup(text, magicKey) {
  if (S.busy) return;
  sugSeq++;
  clearTimeout(sugTimer);
  list.hidden = true;
  err.textContent = '';
  S.busy = true;
  try {
    const g = await geocode(text, magicKey);
    if (!g) { err.textContent = t('notFound'); return; }
    if (g.zip && !zipIn.value) zipIn.value = g.zip;
    await showRoof(g);
  } catch (e) {
    err.textContent = t('netError');
  } finally { S.busy = false; }
}

/* ---------- the roof scene ---------- */
const canvas = $('#cv');
const ctx = canvas.getContext('2d');
let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
let zipData = null;
const loadZipData = () => zipData || (zipData = fetch('assets/data/sce-zips.json').then(r => r.json()).catch(() => null));

function setLoader(on, key) {
  $('#loader').hidden = !on;
  if (key) $('#loader-text').textContent = t(key);
}

async function showRoof(g) {
  S.geo = g; S.zip = (g.zip || '').slice(0, 5);
  S.ready = false; S.layout = null; S.frontAuto = null; S.front = null; S.faceUnsure = false; S.place = null;
  $('#art').hidden = true;
  $('#roof').hidden = false;
  ['#facing', '#place', '#next1', '#neighbors'].forEach(s => { $(s).hidden = true; });
  $('#tradeoff').textContent = '';
  $('#tip').textContent = '';
  setLoader(true, 'step1');
  $('#roof').scrollIntoView({ behavior: 'smooth', block: 'start' });
  sizeCanvas();
  const [fps, util] = await Promise.all([
    footprints(g.lat, g.lon).catch(() => []),
    utilityAt(g.lat, g.lon).catch(() => null),
  ]);
  S.utilName = util || '';
  S.utilKey = utilityKey(util);
  const fp = pickFootprint(fps, g.lat, g.lon);
  S.layout = fp ? layoutPanels(fp.ring) : null;
  const center = S.layout ? S.layout.center : project(g.lat, g.lon);
  S.view = makeView(canvas, center, S.layout ? S.layout.extent : null);
  setLoader(true, 'step2');
  S.tiles = await tilesFor(S.view);
  S.base = buildBase();
  const c = centerLL();
  const facing = facingFor(c);
  S.sun = await sunAt(c.lat, c.lon, chosenAz());
  recompute();
  setLoader(false);
  renderScale();
  $('#tip').textContent = S.layout ? t('tapRoof') : t('noOutline');
  renderNeighbors();
  await animate();
  const f = await facing;
  if (f) { S.frontAuto = { bearing: f.bearing }; S.front = { bearing: f.bearing, how: 'auto' }; }
  await refreshSun();
  S.ready = true;
  renderFacing(); renderPlace(); renderTradeoff();
  $('#next1').hidden = false;
  drawFrame({ labels: true });
}

// Which way the front faces: from the house's middle toward the street point the
// address service returns, else toward the nearest stretch of the named street.
function facingFor(c) {
  const g = S.geo;
  if (g.streetPt) {
    const r = bearingTo(c.lat, c.lon, g.streetPt.lat, g.streetPt.lon);
    if (r.meters > 4 && r.meters < 160) return Promise.resolve({ bearing: r.bearing });
  }
  const streetName = (g.street || g.address || '').split(',')[0].replace(/^\s*\d+[A-Za-z]?\s+/, '');
  return frontBearing(c.lat, c.lon, streetName).catch(() => null);
}

function centerLL() {
  if (S.layout) { const [la, lo] = unproject(S.layout.center[0], S.layout.center[1]); return { lat: la, lon: lo }; }
  return { lat: S.geo.lat, lon: S.geo.lon };
}

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}

// Map coordinates are tens of millions of pixels, beyond what canvas floats keep
// exact, so every point is moved to screen space here, in double precision.
const scr = ([x, y]) => [(x - S.view.x0) * S.view.k, (y - S.view.y0) * S.view.k];

function buildBase() {
  const v = S.view;
  const c = document.createElement('canvas');
  c.width = Math.round(v.w * dpr); c.height = Math.round(v.h * dpr);
  const g = c.getContext('2d');
  g.fillStyle = '#1a2a5e';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const size = 256 * v.k + 0.6;
  for (const { img, x, y } of S.tiles) if (img) g.drawImage(img, (x * 256 - v.x0) * v.k, (y * 256 - v.y0) * v.k, size, size);
  if (S.layout) {
    const ring = S.layout.ring.map(scr);
    g.save();
    g.beginPath();
    g.rect(0, 0, v.w, v.h);
    ring.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fillStyle = 'rgba(12, 18, 46, 0.4)';
    g.fill('evenodd');
    g.restore();
    g.beginPath();
    ring.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = '#f4cc2a';
    g.lineWidth = 2.6;
    g.shadowColor = 'rgba(244, 204, 42, 0.6)';
    g.shadowBlur = 10;
    g.stroke();
  }
  return c;
}

// Today's sun, sunrise to sunset, from SunCalc: compass bearing and height in the sky.
function sunPath() {
  const { lat, lon } = centerLL();
  const SC = window.SunCalc;
  if (!SC) return null;
  const now = new Date();
  const times = SC.getTimes(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), lat, lon);
  const a = times.sunrise, b = times.sunset;
  if (!(a instanceof Date) || isNaN(a) || isNaN(b)) return null;
  const pts = [];
  for (let i = 0; i <= 72; i++) {
    const at = new Date(a.getTime() + ((b - a) * i) / 72);
    const p = SC.getPosition(at, lat, lon);
    pts.push({ at, bearing: ((p.azimuth * 180) / Math.PI + 180 + 360) % 360, alt: Math.max(0, p.altitude) });
  }
  return { pts, sunrise: a, sunset: b, peak: Math.max(...pts.map(p => p.alt)) };
}

function skyXY(p) {
  const v = S.view;
  const [cx, cy] = S.layout ? S.layout.center : project(S.geo.lat, S.geo.lon);
  const sx = (cx - v.x0) * v.k, sy = (cy - v.y0) * v.k;
  const R = Math.min(v.w, v.h) * 0.47;
  const inner = S.layout ? Math.min(R * 0.8, (S.layout.extent / 2) * v.k * 0.82 + 14) : R * 0.35;
  const r = inner + (R - inner) * (1 - p.alt / (Math.PI / 2));
  const rad = (p.bearing * Math.PI) / 180;
  return [sx + r * Math.sin(rad), sy - r * Math.cos(rad)];
}

function chip(text, x, y, fill, ink) {
  const v = S.view;
  ctx.font = '700 12px "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18, h = 24;
  x = Math.max(w / 2 + 6, Math.min(v.w - w / 2 - 6, x));
  y = Math.max(h / 2 + 6, Math.min(v.h - h / 2 - 6, y));
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 12); else ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

function drawPanel(cellWorld, p) {
  const cell = cellWorld.map(scr);
  const cx = (cell[0][0] + cell[2][0]) / 2, cy = (cell[0][1] + cell[2][1]) / 2;
  const s = 1 + (1 - p) * 0.9;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.4);
  ctx.translate(cx, cy - (1 - p) * 14);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  cell.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.fillStyle = 'rgba(30, 52, 138, 0.96)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 3;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(228, 236, 255, 0.95)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(214, 226, 255, 0.32)';
  ctx.lineWidth = 0.55;
  const [a, b, c, d] = cell;
  const lerp = (m, n, k) => [m[0] + (n[0] - m[0]) * k, m[1] + (n[1] - m[1]) * k];
  for (const k of [1 / 3, 2 / 3]) { const m = lerp(a, b, k), n = lerp(d, c, k); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(n[0], n[1]); ctx.stroke(); }
  for (const k of [0.2, 0.4, 0.6, 0.8]) { const m = lerp(a, d, k), n = lerp(b, c, k); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(n[0], n[1]); ctx.stroke(); }
  ctx.restore();
}

// One frame. sweep: 0..1 along today's sun path; shown: how many panels; labels: front/back chips.
function drawFrame({ sweep = 1, shown = null, labels = false, path = sunPathCache } = {}) {
  const v = S.view;
  if (!S.base || !v) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(S.base, 0, 0);
  // light rises and falls with the sun during the sweep
  if (path && sweep < 1) {
    const i = Math.min(path.pts.length - 1, Math.round(sweep * (path.pts.length - 1)));
    const lift = path.peak ? path.pts[i].alt / path.peak : 1;
    ctx.fillStyle = `rgba(8, 12, 36, ${0.34 * (1 - lift)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = shown == null ? S.panels.length : shown;
  for (let i = 0; i < S.panels.length; i++) {
    const p = typeof n === 'number' ? (i < Math.floor(n) ? 1 : i === Math.floor(n) ? n - Math.floor(n) : 0) : 1;
    if (p > 0) drawPanel(S.panels[i].cell, p);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (path) {
    const pts = path.pts.map(skyXY);
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 7]);
    ctx.strokeStyle = 'rgba(244, 204, 42, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.stroke();
    ctx.setLineDash([]);
    const upto = Math.max(1, Math.round(sweep * (pts.length - 1)));
    ctx.strokeStyle = '#f4cc2a';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(244, 204, 42, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i <= upto; i++) (i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]));
    ctx.stroke();
    ctx.shadowBlur = 0;
    const [x, y] = pts[upto];
    if (sweep < 1) {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
      glow.addColorStop(0, 'rgba(255, 236, 140, 0.95)');
      glow.addColorStop(1, 'rgba(255, 220, 90, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4cc2a';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f4cc2a'; ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); ctx.stroke(); }
    }
    if (sweep > 0.02) chip(t('sunrise', { t: clock(path.sunrise) }), pts[0][0], pts[0][1] + 18, 'rgba(13, 21, 51, 0.82)', '#ffffff');
    if (sweep >= 0.98) chip(t('sunset', { t: clock(path.sunset) }), pts.at(-1)[0], pts.at(-1)[1] + 18, 'rgba(13, 21, 51, 0.82)', '#ffffff');
  }
  if (labels && S.front && S.layout) {
    const [cx, cy] = S.layout.center;
    const sx = (cx - v.x0) * v.k, sy = (cy - v.y0) * v.k;
    const reach = (S.layout.extent / 2) * v.k + 16;
    const at = b => { const r = (b * Math.PI) / 180; return [sx + Math.sin(r) * reach, sy - Math.cos(r) * reach]; };
    const f = at(S.front.bearing), bk = at(S.front.bearing + 180);
    chip(t('front'), f[0], f[1], '#f4cc2a', '#141f48');
    chip(t('back'), bk[0], bk[1], '#ffffff', '#141f48');
  }
}

let sunPathCache = null;
function animate() {
  sunPathCache = sunPath();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { drawFrame({ labels: true }); return Promise.resolve(); }
  S.animating = true;
  const SWEEP = 2300, n = S.panels.length, DROP = Math.min(1700, 260 + n * 85);
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  return new Promise(done => {
    const t0 = performance.now();
    const frame = now => {
      const e = now - t0;
      if (e < SWEEP) drawFrame({ sweep: ease(e / SWEEP), shown: 0 });
      else if (e < SWEEP + DROP) drawFrame({ sweep: 1, shown: ((e - SWEEP) / DROP) * n });
      else { drawFrame({ sweep: 1, labels: true }); S.animating = false; done(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function renderScale() {
  const v = S.view;
  const lat = centerLL().lat;
  const mpp = metersPerPx(lat);
  const px = (10 / mpp) * v.k;
  $('#scale').innerHTML = `<i style="width:${Math.round(px)}px"></i>${lang === 'es' ? '10 m' : '33 ft'}`;
}

// Tap the photo to pick the right house.
canvas.addEventListener('click', async e => {
  if (!S.view || S.animating) return;
  const r = canvas.getBoundingClientRect();
  const wx = S.view.x0 + (e.clientX - r.left) / S.view.k, wy = S.view.y0 + (e.clientY - r.top) / S.view.k;
  const [lat, lon] = unproject(wx, wy);
  const fps = await footprints(lat, lon, 8).catch(() => []);
  const fp = pickFootprint(fps, lat, lon);
  if (!fp) return;
  S.layout = layoutPanels(fp.ring);
  S.base = buildBase();
  const c = centerLL();
  const f = await facingFor(c);
  if (f && (!S.front || S.front.how === 'auto')) { S.frontAuto = { bearing: f.bearing }; S.front = { bearing: f.bearing, how: 'auto' }; }
  await refreshSun();
  renderFacing(); renderTradeoff();
  drawFrame({ labels: true });
});

/* ---------- facing and placement ---------- */
function bestAz() {
  if (S.front) { const f = S.front.bearing; return dirFactor(f) >= dirFactor(f + 180) ? f : (f + 180) % 360; }
  if (S.layout) return S.layout.halves[0].bearing;
  return 180;
}
const backAz = () => (S.front ? (S.front.bearing + 180) % 360 : null);
const chosenAz = () => (S.place === 'back' && S.front ? backAz() : bestAz());

async function refreshSun() {
  const c = centerLL();
  S.sun = await sunAt(c.lat, c.lon, chosenAz());
  recompute();
}

function recompute() {
  if (!S.sun) return;
  const back = S.place === 'back' && S.front ? backAz() : null;
  const capacity = S.layout ? slopesFor(S.layout, back).reduce((n, h) => n + h.cells.length, 0) : null;
  const sideScale = dirFactor(chosenAz()) / dirFactor(bestAz());
  S.est = estimate({ bill: S.bill, util: S.utilKey, sun: S.sun, sideScale, capacity });
  S.panels = S.layout ? choosePanels(S.layout, S.est.panels, back) : [];
  renderNumbers();
}

function renderFacing() {
  const el = $('#facing');
  if (!S.ready) return;
  el.hidden = false;
  const confirmed = S.front && S.front.how === 'confirmed';
  const auto = S.frontAuto;
  const q = confirmed ? t('facingSet', { dir: t(`dir.${dirKey(S.front.bearing)}`) })
    : auto ? t('facingQ', { dir: t(`dir.${dirKey(auto.bearing)}`) }) : t('facingAsk');
  const pressed = k => (confirmed && S.front.key === k) || (k === 'unsure' && S.faceUnsure);
  el.innerHTML = `<p>${q}</p><div class="choices">
    ${auto && !confirmed ? `<button class="chip" type="button" data-face="yes">${t('yes')}</button>` : ''}
    ${['N', 'E', 'S', 'W'].map(k => `<button class="chip" type="button" data-face="${k}" aria-pressed="${pressed(k)}">${cap(t(`dir.${k}`))}</button>`).join('')}
    <button class="chip" type="button" data-face="unsure" aria-pressed="${pressed('unsure')}">${t('notSure')}</button></div>
    <p class="help">${t('facingHelp')}</p>`;
}

$('#facing').addEventListener('click', async e => {
  const b = e.target.closest('[data-face]');
  if (!b) return;
  const v = b.dataset.face;
  if (v === 'yes') S.front = { bearing: S.frontAuto.bearing, how: 'confirmed', key: dirKey(S.frontAuto.bearing) };
  else if (v === 'unsure') { S.faceUnsure = true; S.front = S.frontAuto ? { bearing: S.frontAuto.bearing, how: 'auto' } : null; }
  else { S.faceUnsure = false; S.front = { bearing: { N: 0, E: 90, S: 180, W: 270 }[v], how: 'confirmed', key: v }; }
  renderFacing();
  await refreshSun();
  renderTradeoff();
  drawFrame({ labels: true });
});

function renderPlace() {
  const el = $('#place');
  if (!S.ready) return;
  el.hidden = false;
  el.innerHTML = `<p>${t('placeQ')}</p><div class="choices stack">
    ${[['best', 'placeBest'], ['back', 'placeBack'], ['unsure', 'placeUnsure']].map(([k, key]) => `<button class="chip" type="button" data-place="${k}" aria-pressed="${S.place === k}">${t(key)}</button>`).join('')}</div>`;
}

$('#place').addEventListener('click', async e => {
  const b = e.target.closest('[data-place]');
  if (!b) return;
  S.place = b.dataset.place;
  renderPlace();
  await refreshSun();
  renderTradeoff();
  drawFrame({ labels: true });
});

function renderTradeoff() {
  const el = $('#tradeoff');
  if (S.place !== 'back') { el.textContent = ''; return; }
  if (!S.front) { el.textContent = t('backNeedsFront'); return; }
  const fb = dirFactor(backAz()), best = dirFactor(bestAz());
  if (fb < 0.8) { el.textContent = t('backNorth'); return; }
  const p = Math.round((1 - fb / best) * 100);
  el.textContent = p <= 3 ? t('backSame') : t('backLess', { p });
}

async function renderNeighbors() {
  const el = $('#neighbors');
  if (!S.geo) return;
  if (S.utilKey !== 'sce') {
    el.hidden = false;
    el.textContent = t('neighborsNA', { utility: S.utilName || (UTILITIES[S.utilKey] || UTILITIES.other).short });
    return;
  }
  const data = await loadZipData();
  const z = data && data.zips[S.zip];
  if (!z) { el.hidden = true; return; }
  const date = new Date(`${data.asOf}T12:00`).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  el.innerHTML = `<span>${t('neighbors', { n: num(z[0]), y: num(z[1]), zip: S.zip })}</span><small>${esc(t('neighborsSrc', { date }))}</small>`;
  el.hidden = false;
}

$('#next1').addEventListener('click', () => { go(2); renderNumbers(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-back]'); if (b) go(Number(b.dataset.back)); });

/* ---------- bill and estimate ---------- */
const billIn = $('#bill');
billIn.addEventListener('input', () => { S.bill = Number(billIn.value); recompute(); });
$('#own').addEventListener('change', e => { S.own = e.target.checked; renderNumbers(); });

$('#billphoto').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const status = $('#snap-status');
  status.textContent = t('reading', { p: 0 });
  try {
    const r = await readBill(file, p => { status.textContent = t('reading', { p: Math.round(p * 100) }); });
    if (!r.found || !r.monthly) { status.textContent = t('readFail'); return; }
    S.billRead = r;
    S.bill = Math.max(100, Math.min(500, Math.round(r.monthly / 10) * 10));
    billIn.value = String(S.bill);
    const bits = [r.amount ? `$${r.amount.toFixed(2)}` : '', r.kwh ? `${num(r.kwh)} kWh` : '', r.plan || ''].filter(Boolean).join(', ');
    status.textContent = t('readOk', { what: bits });
    recompute();
  } catch (x) {
    status.textContent = t('readFail');
  } finally { e.target.value = ''; }
});

function renderNumbers() {
  $('#bill-out').textContent = S.bill >= 500 ? '$500+' : `$${S.bill}`;
  billIn.value = String(S.bill);
  const u = UTILITIES[S.utilKey] || UTILITIES.other;
  $('#utility-line').textContent = S.geo ? t('utility', { u: S.utilName || u.name }) : '';
  const est = S.est;
  const box = $('#estimate');
  if (!est) { box.innerHTML = ''; return; }
  const head = est.small
    ? `<p class="est-small">${t('estSmall')}</p>`
    : `<span class="est-label">${t('estSavings')}</span><div class="est-big">$${est.low}–$${est.high}<small>${t('perMonth')}</small></div>`;
  box.innerHTML = `${head}<p class="est-note">${t('estLabel')}</p>
    <div class="facts"><span>${t('sunHours', { h: est.sunHours })}</span><span>${t('panels', { n: est.panels, kw: est.kw })}</span><span>${t('coverage', { c: Math.min(100, Math.round(est.coverage * 100)) })}</span></div>
    ${est.roofLimited ? `<p class="est-note">${esc(t('roofLimited', { n: est.panels }))}</p>` : ''}`;
  const owner = $('#owner-note');
  owner.hidden = S.own;
  $('#next2').hidden = !S.own;
  if (!S.own) owner.innerHTML = `<span>${esc(t('notOwner'))}</span><button class="btn" type="button" id="send-owner">${esc(t('sendOwner'))}</button>`;
}

$('#owner-note').addEventListener('click', async e => {
  if (!e.target.closest('#send-owner')) return;
  const res = await shareOrCopy({ title: 'Sun Check', text: t('neighborMsg'), url: repLink({ s: 'o', a: S.geo && S.geo.address }) });
  if (res === 'copied') toast(t('copied'));
});

$('#next2').addEventListener('click', () => { go(3); renderTimes(); });

/* ---------- times and contact ---------- */
function renderTimes() {
  const P = t('prefs');
  $('#prefs').innerHTML = ['eve', 'sat', 'sun', 'day'].map(k => `<button class="chip" type="button" data-pref="${k}" aria-pressed="${S.prefs.has(k)}">${esc(P[k])}</button>`).join('');
  $('#meet').innerHTML = [['visit', 'meetVisit'], ['call', 'meetCall'], ['either', 'meetEither']].map(([k, key]) => `<button type="button" data-meet="${k}" aria-pressed="${S.meet === k}">${esc(t(key))}</button>`).join('');
  const co = `<span class="placeholder">${esc(t('company'))}</span>`;
  $('#t-consent').innerHTML = t('consent', { company: co, rep: esc(rep.first) }).replace(/\s+(may|me llamen)/, ' $1').replace(/ {2,}/g, ' ');
  const alt = $('#t-consentalt');
  alt.hidden = !rep.phone;
  if (rep.phone) alt.textContent = t('consentAlt', { rep: repName(), phone: fmtPhone(rep.phone) });
  $('#send').textContent = rep.first ? t('send', { rep: rep.first }) : t('sendGeneric');
}
$('#prefs').addEventListener('click', e => {
  const b = e.target.closest('[data-pref]');
  if (!b) return;
  const k = b.dataset.pref;
  if (S.prefs.has(k)) S.prefs.delete(k); else S.prefs.add(k);
  b.setAttribute('aria-pressed', String(S.prefs.has(k)));
});
$('#meet').addEventListener('click', e => {
  const b = e.target.closest('[data-meet]');
  if (!b) return;
  S.meet = b.dataset.meet;
  $$('#meet button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
});
$('#privacy').addEventListener('click', () => sheet({ title: t('privacy'), body: `<p style="line-height:1.55">${esc(t('privacyText', { rep: repName() }))}</p>` }));

// In the order the company's own web form asks: name, phone, email, address, ZIP, own or rent.
function details(name, phone, email) {
  const e = S.est;
  const P = makeT('en')('prefs');
  const face = S.front ? `${cap(makeT('en')(`dir.${dirKey(S.front.bearing)}`))} (${S.front.how === 'confirmed' ? 'confirmed by them' : 'estimated from the map'})` : 'Not sure';
  const place = { best: 'Wherever makes the most power', back: 'Back only (not seen from the street)', unsure: 'Not sure yet' }[S.place] || 'Not asked';
  const lines = [
    `Name: ${name}`, `Mobile: ${fmtPhone(phone)}`, `Email: ${email || '-'}`,
    `Address: ${S.geo ? S.geo.address : '-'}`, `ZIP: ${S.zip || '-'}`, `Owns the home: ${S.own ? 'Yes' : 'No'}`,
    `Front faces: ${face}`, `Panels: ${place}`,
    `Monthly bill: about $${S.bill}${S.bill >= 500 ? '+' : ''}${S.billRead ? ` (read from their bill: ${[S.billRead.amount ? `$${S.billRead.amount.toFixed(2)}` : '', S.billRead.kwh ? `${S.billRead.kwh} kWh` : '', S.billRead.days ? `${S.billRead.days} days` : ''].filter(Boolean).join(', ')})` : ''}`,
    `Utility: ${S.utilName || '-'}`,
    `Prefers: ${[...S.prefs].map(k => P[k]).join(', ')}`,
    `Meeting: ${{ visit: 'Consultant comes by', call: 'Phone or video', either: 'Either' }[S.meet]}`,
    `Partner may join: ${$('#partner').checked ? 'Yes' : 'No'}`,
    `Estimate shown: ${e ? `${e.panels} panels (${e.kw} kW), ${e.sunHours} sun hours a day, ${e.small ? 'little savings at this bill' : `est. $${e.low}-$${e.high}/mo`}` : '-'}`,
    `Came from: ${{ c: 'No-time card', f: 'Friend card', k: 'Counter sign', h: 'Door hanger', q: 'Her code on the floor', b: 'Her link', m: 'Maybe-list text', n: 'Neighbor link', p: 'Partner link', o: 'Sent to the owner' }[frag.s] || 'Direct'}${frag.ref ? `, referred by ${frag.ref}` : ''}${frag.st ? `, street ${frag.st}` : ''}`,
    `Language: ${lang === 'es' ? 'Spanish' : 'English'}`,
    `OK to call/text: ${$('#consent').checked ? `Yes, ticked ${new Date().toLocaleString('en-US')}` : 'Not ticked (reply only about this request)'}`,
  ];
  if ($('#consent').checked) lines.push(`Wording shown: ${$('#t-consent').textContent}`);
  return lines.join('\n');
}

$('#contact').addEventListener('submit', async e => {
  e.preventDefault();
  const se = $('#send-err');
  se.textContent = '';
  const name = $('#cname').value.trim(), phone = digits($('#cphone').value), email = $('#cemail').value.trim();
  if (!S.prefs.size) { se.textContent = t('errPrefs'); return; }
  if (!name) { se.textContent = t('errName'); $('#cname').focus(); return; }
  if (!validPhone(phone)) { se.textContent = t('errPhone'); $('#cphone').focus(); return; }
  const body = details(name, phone, email);
  const btn = $('#send');
  btn.disabled = true;
  btn.textContent = t('sending');
  try {
    if (live) {
      const f = new URLSearchParams();
      const [eName, ePhone, eDetails] = rep.form.entries;
      f.set(`entry.${eName}`, name); f.set(`entry.${ePhone}`, fmtPhone(phone)); f.set(`entry.${eDetails}`, body);
      await fetch(`https://docs.google.com/forms/d/e/${encodeURIComponent(rep.form.id)}/formResponse`, { method: 'POST', mode: 'no-cors', body: f });
    } else {
      saveDemo(name, phone, email);
    }
    S.sentAt = Date.now();
    S.sentDetails = body;
    S.first = name.split(/\s+/)[0];
    go(4);
    renderDone();
  } catch (x) {
    se.textContent = t('errSend');
  } finally {
    btn.disabled = false;
    renderTimes();
  }
});

// Demo only: put the request where the coach on this same phone can see it.
function saveDemo(name, phone, email) {
  try {
    const key = 'suncheck.v1';
    const d = JSON.parse(localStorage.getItem(key) || '{}');
    d.bookings = d.bookings || [];
    const parts = name.split(/\s+/);
    d.bookings.unshift({
      id: Math.random().toString(36).slice(2, 9), first: parts[0], last: parts.slice(1).join(' '), phone, email,
      when: null, prefs: [...S.prefs], type: S.meet === 'either' ? '' : S.meet, both: $('#partner').checked ? 'both' : '',
      address: S.geo ? S.geo.address : '', street: S.geo ? (S.geo.street || '') : '', zip: S.zip, own: S.own, bill: S.bill,
      utility: S.utilName, facing: S.front ? cap(makeT('en')(`dir.${dirKey(S.front.bearing)}`)) : '', facingHow: S.front ? (S.front.how === 'confirmed' ? 'confirmed' : 'estimated') : '',
      placement: { best: 'Wherever makes the most power', back: 'Back only', unsure: 'Not sure yet' }[S.place] || '',
      estimate: S.est ? `${S.est.panels} panels (${S.est.kw} kW), ${S.est.sunHours} sun hours a day` : '',
      src: 'After-hours page', ref: frag.ref || '', created: Date.now(), sent: {},
    });
    localStorage.setItem(key, JSON.stringify(d));
  } catch (x) { /* storage blocked: the demo still shows the confirmation */ }
}

/* ---------- done ---------- */
function renderDone() {
  const el = $('#s4');
  const first = S.first || '';
  const ready = t('ready');
  el.innerHTML = `
    <div class="ticket"><span class="sentstamp">${live ? esc(t('sent')) : 'Demo'}</span>
      <h2 class="display" id="t-done">${esc(t('sent'))}</h2>
      ${live ? '' : `<p class="small muted">${esc(t('demoSent'))}</p>`}
      <p style="font-size:1.0625rem">${esc(capFirst(t('doneText', { rep: repName() })))}</p>
      ${rep.phone ? `<button class="btn ghost" type="button" id="vcard">${esc(t('saveContact', { rep: repName() }))}</button>` : ''}
    </div>
    <div class="ready"><h3>${esc(t('readyTitle'))}</h3><ul>${ready.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <button class="btn wide" type="button" id="share-partner">${esc(t('partnerBtn'))}</button>
    <div class="neighbor-card"><h3>${esc(t('neighborTitle'))}</h3><p>${esc(t('neighborText'))}</p>
      <button class="btn" type="button" id="share-neighbor">${esc(t('neighborBtn'))}</button>
      <small>${esc(t('reward', { rep: repName() }))}</small></div>
    ${live ? '' : `<details class="repgets"><summary>${esc(t('repGets', { rep: repName() }))}</summary><pre>${esc(S.sentDetails || '')}</pre><p class="small"><a href="rep/#tonight">Open the coach</a></p></details>`}
    <button class="linkbtn" type="button" id="again">${esc(t('again'))}</button>`;
}

$('#s4').addEventListener('click', async e => {
  if (e.target.closest('#vcard')) {
    const v = `BEGIN:VCARD\nVERSION:3.0\nFN:${repName()} (solar)\nTEL;TYPE=CELL:+1${rep.phone}\nEND:VCARD\n`;
    download(`${repName()}-solar.vcf`, v, 'text/vcard');
  }
  if (e.target.closest('#share-partner')) {
    const res = await shareOrCopy({ title: 'Sun Check', text: t('partnerMsg'), url: repLink({ s: 'p', a: S.geo && S.geo.address }) });
    if (res === 'copied') toast(t('copied'));
  }
  if (e.target.closest('#share-neighbor')) {
    const res = await shareOrCopy({ title: 'Sun Check', text: t('neighborMsg'), url: repLink({ s: 'n', ref: S.first }) });
    if (res === 'copied') toast(t('copied'));
  }
  if (e.target.closest('#again')) { location.reload(); }
});

/* ---------- start ---------- */
window.addEventListener('resize', () => {
  if (!S.view || S.animating) return;
  sizeCanvas();
  const center = S.layout ? S.layout.center : project(S.geo.lat, S.geo.lon);
  S.view = makeView(canvas, center, S.layout ? S.layout.extent : null);
  tilesFor(S.view).then(tl => { S.tiles = tl; S.base = buildBase(); renderScale(); drawFrame({ labels: true }); });
});

applyText();
if (prefill.first) $('#cname').value = prefill.first;
if (prefill.address) { street.value = prefill.address.split(',')[0]; const z = prefill.address.match(/\b\d{5}\b/); if (z) zipIn.value = z[0]; lookup(prefill.address); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
