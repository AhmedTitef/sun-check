// Roof lookup and drawing, all from free public sources, run in the shopper's browser:
// Esri for address search and aerial photos, FEMA's USA Structures for the roof
// outline, the California Energy Commission map for the utility, and NREL's PVWatts
// (now at the National Laboratory of the Rockies) for sun data.

const ESRI_GEO = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const FEMA = 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query';
const CEC = 'https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/ElectricLoadServingEntities_IOU_POU/FeatureServer/0/query';
const PVWATTS = 'https://developer.nlr.gov/api/pvwatts/v8.json';
const Z = 19;
const IE = '-117.35,34.0'; // bias address search toward the Inland Empire

async function getJSON(url, params, { timeout = 12000 } = {}) {
  const u = new URL(url);
  u.search = new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* ---------- addresses ---------- */
export async function suggest(text) {
  if (text.trim().length < 4) return [];
  const j = await getJSON(`${ESRI_GEO}/suggest`, { text, f: 'json', countryCode: 'USA', category: 'Address', maxSuggestions: '5', location: IE }, { timeout: 6000 });
  return (j.suggestions || []).filter(s => !s.isCollection).map(s => ({ text: s.text.replace(/, USA$/, ''), magicKey: s.magicKey }));
}

export async function geocode(text, magicKey) {
  const params = { SingleLine: text, f: 'json', maxLocations: '1', outFields: 'Addr_type,City,Postal,StAddr,X,Y,DisplayX,DisplayY', countryCode: 'USA', location: IE };
  if (magicKey) params.magicKey = magicKey;
  const j = await getJSON(`${ESRI_GEO}/findAddressCandidates`, params);
  const c = j.candidates && j.candidates[0];
  if (!c || c.score < 75) return null;
  const a = c.attributes;
  // X/Y is the point on the street in front of the address; DisplayX/Y is the rooftop.
  const roofLat = a.DisplayY || c.location.y, roofLon = a.DisplayX || c.location.x;
  const streetPt = a.X && a.Y && (Math.abs(a.X - roofLon) > 1e-6 || Math.abs(a.Y - roofLat) > 1e-6) ? { lat: a.Y, lon: a.X } : null;
  return { address: c.address.replace(/, USA$/, ''), lat: roofLat, lon: roofLon, exact: /PointAddress|Subaddress/.test(a.Addr_type || ''), city: a.City, zip: a.Postal, street: a.StAddr, streetPt };
}

// Compass bearing from one point to another, in degrees (0 = north, clockwise).
export function bearingTo(lat1, lon1, lat2, lon2) {
  const kx = Math.cos((lat1 * Math.PI) / 180) * 111320;
  const dx = (lon2 - lon1) * kx, dy = (lat2 - lat1) * 110540;
  return { bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360, meters: Math.hypot(dx, dy) };
}

export async function reverse(lat, lon) {
  const j = await getJSON(`${ESRI_GEO}/reverseGeocode`, { location: `${lon},${lat}`, f: 'json', featureTypes: 'PointAddress,StreetAddress', outSR: '4326' });
  const a = j.address;
  if (!a) return null;
  return { address: (a.LongLabel || a.Match_addr || '').replace(/, USA$/, ''), street: a.Address, zip: a.Postal, city: a.City, lat, lon };
}

/* ---------- utility ---------- */
export async function utilityAt(lat, lon) {
  const j = await getJSON(CEC, { geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'Utility,Acronym,Type', returnGeometry: 'false', f: 'json' });
  const hit = (j.features || []).map(f => f.attributes).find(a => !/water/i.test(a.Utility));
  return hit ? hit.Utility : null;
}

/* ---------- roof outline ---------- */
export async function footprints(lat, lon, radius = 30) {
  const j = await getJSON(FEMA, { geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', distance: String(radius), units: 'esriSRUnit_Meter', outFields: 'OCC_CLS,PRIM_OCC,SQFEET', outSR: '4326', f: 'geojson', resultRecordCount: '30' });
  return (j.features || []).filter(f => f.geometry && f.geometry.type === 'Polygon').map(f => ({ ring: f.geometry.coordinates[0], sqft: f.properties.SQFEET, occ: f.properties.OCC_CLS || '' }));
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function ringDist(p, ring) {
  let d = Infinity;
  for (let i = 0; i < ring.length - 1; i++) d = Math.min(d, segDist(p, ring[i], ring[i + 1]));
  return d;
}

// The house at the point: the outline that contains it, else the nearest home-sized one.
export function pickFootprint(list, lat, lon) {
  const pt = [lon, lat];
  const homes = list.filter(f => (f.sqft || 0) >= 500);
  const pool = homes.length ? homes : list;
  const containing = pool.filter(f => inRing(pt, f.ring));
  if (containing.length) return containing.sort((a, b) => (b.sqft || 0) - (a.sqft || 0))[0];
  const scored = pool.map(f => ({ f, d: ringDist(pt, f.ring) * (/resid/i.test(f.occ) ? 1 : 1.6) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.length && scored[0].d < 0.00025 ? scored[0].f : null; // about 25 m
}

/* ---------- sun ---------- */
// Yearly output by roof direction at a 20 degree pitch, relative to due south
// (PVWatts v8 runs for Riverside, Oct 2026).
const DIRS = [[0, 0.695], [45, 0.78], [90, 0.852], [135, 0.953], [180, 1], [225, 0.969], [270, 0.876], [315, 0.78], [360, 0.695]];
export function dirFactor(bearing) {
  const b = ((bearing % 360) + 360) % 360;
  for (let i = 0; i < DIRS.length - 1; i++) {
    const [a0, f0] = DIRS[i], [a1, f1] = DIRS[i + 1];
    if (b >= a0 && b <= a1) return f0 + ((f1 - f0) * (b - a0)) / (a1 - a0);
  }
  return 1;
}

function fallbackSun(lat, lon) {
  // Typical Inland Empire values when the free sun service is busy.
  const desert = lon > -116.75 || lat > 34.35;
  return { perKw: desert ? 1790 : 1690, sunHours: desert ? 6.5 : 6.2, source: 'typical' };
}

// Yearly output per kW for a roof side facing `azimuth`, at a typical 20 degree pitch.
// One PVWatts run per spot (facing south), then adjusted for the side's direction
// with factors from PVWatts runs, so the free service's hourly limit isn't hit.
const sunCache = new Map();
async function southSun(lat, lon) {
  const key = `pv:${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (sunCache.has(key)) return sunCache.get(key);
  const job = (async () => {
    try { const hit = JSON.parse(localStorage.getItem(key) || 'null'); if (hit && hit.perKw) return hit; } catch (e) { /* ignore */ }
    try {
      const j = await getJSON(PVWATTS, { api_key: 'DEMO_KEY', lat: lat.toFixed(4), lon: lon.toFixed(4), system_capacity: '1', azimuth: '180', tilt: '20', array_type: '1', module_type: '0', losses: '14' }, { timeout: 9000 });
      if (!j.outputs || !j.outputs.ac_annual) throw new Error('no output');
      const out = { perKw: Math.round(j.outputs.ac_annual), sunHours: Math.round(j.outputs.solrad_annual * 100) / 100, source: 'pvwatts' };
      try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) { /* ignore */ }
      return out;
    } catch (e) { return fallbackSun(lat, lon); }
  })();
  sunCache.set(key, job);
  return job;
}
export async function sunAt(lat, lon, azimuth = 180) {
  const base = await southSun(lat, lon);
  const k = dirFactor(azimuth);
  return { perKw: Math.round(base.perKw * k), sunHours: Math.round(base.sunHours * k * 10) / 10, azimuth: Math.round(azimuth), source: base.source };
}

/* ---------- map math (Web Mercator at zoom 19) ---------- */
export function project(lat, lon, z = Z) {
  const s = 256 * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
}
export function unproject(x, y, z = Z) {
  const s = 256 * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return [(180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon];
}
export const metersPerPx = (lat, z = Z) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/* ---------- a rough panel layout on the roof outline ---------- */
// Treat the roof as two slopes split along its long side. Fill the sunnier slope
// first with 1.13 x 1.76 m panels, keeping 0.45 m clear of edges and the ridge.
export function layoutPanels(ringLL) {
  const pts = ringLL.map(([lon, lat]) => project(lat, lon));
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-6) pts.pop();
  const lat0 = ringLL.reduce((a, p) => a + p[1], 0) / ringLL.length;
  const mpp = metersPerPx(lat0);
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p[0]; cy += p[1]; });
  cx /= pts.length; cy /= pts.length;
  let ang = 0, longest = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > longest) { longest = L; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  const rot = ([x, y]) => [(x - cx) * cos - (y - cy) * sin, (x - cx) * sin + (y - cy) * cos];
  const back = ([u, v]) => [u * Math.cos(ang) - v * Math.sin(ang) + cx, u * Math.sin(ang) + v * Math.cos(ang) + cy];
  const Q = pts.map(rot);
  const QR = [...Q, Q[0]];
  const us = Q.map(p => p[0]), vs = Q.map(p => p[1]);
  const minU = Math.min(...us), maxU = Math.max(...us), minV = Math.min(...vs), maxV = Math.max(...vs);
  const ridge = (minV + maxV) / 2;
  const pw = 1.134 / mpp, pd = (1.762 * Math.cos((20 * Math.PI) / 180)) / mpp;
  const edge = 0.45 / mpp, gap = 0.45 / mpp;
  const halves = [];
  for (const side of [-1, 1]) {
    const nx = -side * Math.sin(ang), ny = side * Math.cos(ang);
    const bearing = ((Math.atan2(nx, -ny) * 180) / Math.PI + 360) % 360;
    const found = [];
    const span = maxU - minU;
    const n = Math.floor(span / pw);
    const off = minU + (span - n * pw) / 2;
    let outer = ridge;
    for (let r = 0; r < 40; r++) {
      const vA = side < 0 ? ridge - gap - pd * (r + 1) : ridge + gap + pd * r;
      const vB = vA + pd;
      if (side < 0 ? vA < minV : vB > maxV) break;
      for (let c = 0; c < n; c++) {
        const uA = off + c * pw, uB = uA + pw;
        const corners = [[uA, vA], [uB, vA], [uB, vB], [uA, vB]];
        if (corners.every(p => inRing(p, QR) && ringDist(p, QR) >= edge)) {
          found.push({ r, c, u: (uA + uB) / 2, v: (vA + vB) / 2 });
          outer = side < 0 ? Math.min(outer, vA) : Math.max(outer, vB);
        }
      }
    }
    const k = 0.9; // shrink each panel a little so the gaps between them show
    const cells = found.map(f => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => back([f.u + (a * pw * k) / 2, f.v + (b * pd * k) / 2])));
    found.forEach((f, i) => { f.cell = cells[i]; });
    halves.push({ bearing, factor: dirFactor(bearing), cells, grid: found, mid: (ridge + outer) / 2 });
  }
  halves.sort((a, b) => b.factor - a.factor);
  const usable = halves.filter(h => h.factor >= 0.8);
  return {
    halves,
    capacity: usable.reduce((n, h) => n + h.cells.length, 0),
    areaM2: Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2) * mpp * mpp,
    center: [cx, cy],
    extent: Math.max(maxU - minU, maxV - minV),
    ring: pts,
  };
}

// Pick n panels: sunniest slope first, then the other slope if it isn't north-facing.
// With a back-only wish, use only the slope that faces most toward the back.
export function slopesFor(layout, back = null) {
  if (back == null) return layout.halves.filter(h => h.factor >= 0.8);
  const off = h => Math.abs(((h.bearing - back + 540) % 360) - 180);
  return [...layout.halves].sort((a, b) => off(a) - off(b)).slice(0, 1);
}
// Lay panels out the way installers do: a tidy block of full rows, centered on the
// slope and wider along the ridge than it is deep.
function blockOf(h, n) {
  const rows = new Map();
  for (const g of h.grid) { if (!rows.has(g.r)) rows.set(g.r, []); rows.get(g.r).push(g); }
  const order = [...rows.keys()].sort((a, b) => Math.abs(rows.get(a)[0].v - h.mid) - Math.abs(rows.get(b)[0].v - h.mid));
  const R = Math.max(1, Math.min(order.length, Math.round(Math.sqrt(n / 2.2))));
  const C = Math.ceil(n / R);
  const picked = [];
  for (const r of order.slice(0, R).sort((a, b) => a - b)) {
    const row = rows.get(r).sort((a, b) => a.c - b.c);
    const mid = (row[0].c + row.at(-1).c) / 2;
    row.sort((a, b) => Math.abs(a.c - mid) - Math.abs(b.c - mid));
    picked.push(...row.slice(0, C));
  }
  // top up from the remaining rows if the block came up short
  for (const r of order.slice(R)) { if (picked.length >= n) break; picked.push(...rows.get(r).slice(0, n - picked.length)); }
  return picked.slice(0, n).sort((a, b) => a.r - b.r || a.c - b.c);
}
export function choosePanels(layout, n, back = null) {
  const out = [];
  for (const h of slopesFor(layout, back)) {
    if (out.length >= n) break;
    for (const g of blockOf(h, Math.min(n - out.length, h.grid.length))) out.push({ cell: g.cell, factor: h.factor });
  }
  return out;
}

/* ---------- drawing ---------- */
const tiles = new Map();
function tile(x, y) {
  const k = `${x}/${y}`;
  if (!tiles.has(k)) {
    tiles.set(k, new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = `${TILE}${Z}/${y}/${x}`;
    }));
  }
  return tiles.get(k);
}

export async function tilesFor(view) {
  const tx0 = Math.floor(view.x0 / 256), ty0 = Math.floor(view.y0 / 256);
  const tx1 = Math.floor((view.x0 + view.w / view.k) / 256), ty1 = Math.floor((view.y0 + view.h / view.k) / 256);
  const jobs = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) jobs.push(tile(x, y).then(img => ({ img, x, y })));
  return Promise.all(jobs);
}

export function makeView(canvas, center, extentPx) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const k = extentPx ? Math.max(1.05, Math.min(2.8, (w * 0.7) / extentPx)) : 1.6;
  return { w, h, k, x0: center[0] - w / (2 * k), y0: center[1] - h / (2 * k) };
}

export function toWorld(view, px, py) { return [view.x0 + px / view.k, view.y0 + py / view.k]; }

export async function drawRoof(canvas, view, { ring = null, panels = [], animate = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const T = () => ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, -view.x0 * dpr * view.k, -view.y0 * dpr * view.k);
  const tx0 = Math.floor(view.x0 / 256), ty0 = Math.floor(view.y0 / 256);
  const tx1 = Math.floor((view.x0 + view.w / view.k) / 256), ty1 = Math.floor((view.y0 + view.h / view.k) / 256);
  const jobs = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) jobs.push(tile(x, y).then(img => ({ img, x, y })));
  const loaded = await Promise.all(jobs);
  const base = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a2a5e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    T();
    for (const { img, x, y } of loaded) if (img) ctx.drawImage(img, x * 256, y * 256, 256.6, 256.6);
    if (ring) {
      // Dim everything but the roof, then outline it.
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x0, view.y0, view.w / view.k, view.h / view.k);
      ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = 'rgba(12, 18, 46, 0.42)';
      ctx.fill('evenodd');
      ctx.restore();
      ctx.beginPath();
      ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#f4cc2a';
      ctx.lineWidth = 2.6 / view.k;
      ctx.shadowColor = 'rgba(244, 204, 42, 0.55)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };
  const panel = cell => {
    ctx.beginPath();
    cell.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = 'rgba(22, 34, 92, 0.93)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 226, 255, 0.75)';
    ctx.lineWidth = 0.9 / view.k;
    ctx.stroke();
    // Cell lines: two across, five down
    ctx.strokeStyle = 'rgba(214, 226, 255, 0.22)';
    ctx.lineWidth = 0.6 / view.k;
    const [a, b, c, d] = cell;
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (const t of [1 / 3, 2 / 3]) { const p = lerp(a, b, t), q = lerp(d, c, t); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
    for (const t of [0.2, 0.4, 0.6, 0.8]) { const p = lerp(a, d, t), q = lerp(b, c, t); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduce || !panels.length) { base(); panels.forEach(p => panel(p.cell)); return; }
  const start = performance.now();
  const dur = Math.min(1400, 260 + panels.length * 55);
  await new Promise(done => {
    const frame = now => {
      const shown = Math.min(panels.length, Math.ceil(((now - start) / dur) * panels.length));
      base();
      for (let i = 0; i < shown; i++) panel(panels[i].cell);
      if (shown < panels.length) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  });
}

/* ---------- which way the front faces ---------- */
// The street in the address, from OpenStreetMap (Overpass). Only coordinates and
// the street name are sent; never anyone's name.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const SUFFIX = { st: 'street', ave: 'avenue', av: 'avenue', dr: 'drive', rd: 'road', blvd: 'boulevard', ln: 'lane', ct: 'court', pl: 'place', cir: 'circle', pkwy: 'parkway', ter: 'terrace', trl: 'trail', hwy: 'highway', cv: 'cove', pt: 'point', sq: 'square', wy: 'way' };
const DIRWORD = { n: 'north', s: 'south', e: 'east', w: 'west', ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest' };
export function normStreet(s) {
  return String(s || '').toLowerCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => SUFFIX[w] || DIRWORD[w] || w).join(' ').trim();
}

async function streetsNear(lat, lon, radius = 90) {
  const q = `[out:json][timeout:12];way(around:${radius},${lat.toFixed(6)},${lon.toFixed(6)})[highway][name];out tags geom;`;
  for (const url of OVERPASS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const j = await r.json();
      return (j.elements || []).filter(e => e.geometry && e.geometry.length > 1 && e.tags && e.tags.name);
    } catch (e) { /* try the next mirror */ }
  }
  return [];
}

// Bearing (0 = north, clockwise) from the house's middle to the nearest point on
// the address's street. That's the way the front faces.
export async function frontBearing(centerLat, centerLon, streetName) {
  const ways = await streetsNear(centerLat, centerLon);
  if (!ways.length) return null;
  const want = normStreet(streetName);
  const core = want.replace(/^(north|south|east|west)\s+/, '').replace(/\s+(street|avenue|drive|road|boulevard|lane|court|place|circle|parkway|terrace|trail|way)$/, '');
  const kx = Math.cos((centerLat * Math.PI) / 180) * 111320, ky = 110540;
  const local = g => [(g.lon - centerLon) * kx, (g.lat - centerLat) * ky];
  let best = null;
  for (const w of ways) {
    const name = normStreet(w.tags.name);
    const match = want && (name === want ? 2 : core && name.includes(core) ? 1 : 0);
    const pts = w.geometry.map(local);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      const px = ax + t * dx, py = ay + t * dy;
      const d = Math.hypot(px, py);
      const score = d - (match === 2 ? 1000 : match === 1 ? 500 : 0);
      if (!best || score < best.score) best = { score, d, px, py, match, name: w.tags.name };
    }
  }
  if (!best || best.d > 120) return null;
  const bearing = ((Math.atan2(best.px, best.py) * 180) / Math.PI + 360) % 360;
  return { bearing, street: best.name, matched: best.match > 0, meters: Math.round(best.d) };
}

export const COMPASS8 = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
export const compass8 = b => COMPASS8[Math.round((((b % 360) + 360) % 360) / 45) % 8];
export const COMPASS4 = { N: 0, E: 90, S: 180, W: 270 };
export const NAME4 = { N: 'North', E: 'East', S: 'South', W: 'West' };

// Label the street side and the back on the photo.
export function drawSides(canvas, view, layout, front) {
  if (front == null || !layout) return;
  const ctx = canvas.getContext('2d');
  const dpr = canvas.width / view.w;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [cx, cy] = layout.center;
  const sx = (cx - view.x0) * view.k, sy = (cy - view.y0) * view.k;
  const reach = (layout.extent / 2) * view.k + 22;
  const chip = (bearing, text, fill, ink) => {
    const r = (bearing * Math.PI) / 180;
    let x = sx + Math.sin(r) * reach, y = sy - Math.cos(r) * reach;
    ctx.font = '700 12px "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 18, h = 24;
    x = Math.max(w / 2 + 6, Math.min(view.w - w / 2 - 6, x));
    y = Math.max(h / 2 + 6, Math.min(view.h - h / 2 - 6, y));
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 12);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  };
  chip(front, 'Front (street)', '#f4cc2a', '#141f48');
  chip(front + 180, 'Back', '#ffffff', '#141f48');
}
