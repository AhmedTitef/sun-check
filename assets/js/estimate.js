// A rough, honest estimate for the hook. Every number on screen is labeled an estimate.
// Rates are 2026 averages from each utility's published schedules and EIA data.

export const UTILITIES = {
  sce: { name: 'Southern California Edison', short: 'Edison', rate: 0.345, fixed: 24.15 },
  rpu: { name: 'Riverside Public Utilities', short: 'Riverside Public Utilities', rate: 0.202, fixed: 25 },
  mvu: { name: 'Moreno Valley Utility', short: 'Moreno Valley Utility', rate: 0.399, fixed: 15 },
  rcmu: { name: 'Rancho Cucamonga Municipal Utility', short: 'Rancho Cucamonga Municipal Utility', rate: 0.19, fixed: 12 },
  colton: { name: 'Colton Electric', short: 'Colton Electric', rate: 0.249, fixed: 10 },
  banning: { name: 'Banning Electric', short: 'Banning Electric', rate: 0.25, fixed: 10 },
  iid: { name: 'Imperial Irrigation District', short: 'IID', rate: 0.179, fixed: 10 },
  anza: { name: 'Anza Electric Cooperative', short: 'Anza Electric', rate: 0.218, fixed: 29, capKw: 5 },
  bves: { name: 'Bear Valley Electric Service', short: 'Bear Valley Electric', rate: 0.307, fixed: 23 },
  other: { name: 'your utility', short: 'your utility', rate: 0.3, fixed: 15 },
};

export function utilityKey(name) {
  const n = String(name || '').toLowerCase();
  if (/edison/.test(n)) return 'sce';
  if (/riverside/.test(n)) return 'rpu';
  if (/moreno/.test(n)) return 'mvu';
  if (/rancho/.test(n)) return 'rcmu';
  if (/colton/.test(n)) return 'colton';
  if (/banning/.test(n)) return 'banning';
  if (/imperial/.test(n)) return 'iid';
  if (/anza/.test(n)) return 'anza';
  if (/bear valley/.test(n)) return 'bves';
  return name ? 'other' : 'sce';
}

// Estimated savings after the cost of a typical lease or monthly plan, as a share
// of an Edison bill (research note, Oct 2026: EnergySage's ~$143/mo average lease,
// Edison's 34.5 cents/kWh average and $24.15 fixed charge). Bill -> [low %, high %].
const BANDS = [[0, 0, 0], [150, 0, 3], [207, 0, 10], [276, 20, 30], [345, 23, 32], [500, 25, 33], [900, 25, 33]];
function band(bill) {
  for (let i = 0; i < BANDS.length - 1; i++) {
    const [b0, l0, h0] = BANDS[i], [b1, l1, h1] = BANDS[i + 1];
    if (bill >= b0 && bill <= b1) { const t = (bill - b0) / (b1 - b0); return [l0 + (l1 - l0) * t, h0 + (h1 - h0) * t]; }
  }
  return [25, 33];
}

const PANEL_KW = 0.41;
const round5 = (x, up) => (up ? Math.ceil(x / 5) : Math.floor(x / 5)) * 5;

// sun: per-kW yearly output on the side that would hold the panels.
// sideScale: that side's sun compared with the best side (1 = best side).
export function estimate({ bill, util = 'sce', sun, sideScale = 1, capacity = null }) {
  const u = UTILITIES[util] || UTILITIES.other;
  const monthlyKwh = Math.max(0, bill - u.fixed) / u.rate;
  const yearlyKwh = monthlyKwh * 12;
  let kw = (yearlyKwh * 0.9) / Math.max(400, sun.perKw);
  if (u.capKw) kw = Math.min(kw, u.capKw);
  let panels = Math.max(6, Math.round(kw / PANEL_KW));
  let roofLimited = false;
  if (capacity != null && capacity > 0 && panels > capacity) { panels = capacity; roofLimited = true; }
  kw = panels * PANEL_KW;
  const yearlyMade = kw * sun.perKw;
  const coverage = yearlyKwh ? Math.min(1.1, yearlyMade / yearlyKwh) : 0;
  let [lo, hi] = band(bill);
  const scale = Math.min(1, u.rate / 0.345) ** 1.5 * Math.min(1, coverage / 0.85) * Math.min(1, sideScale);
  lo *= scale; hi *= scale;
  const low = round5((bill * lo) / 100, false);
  const high = Math.max(low + 5, round5((bill * hi) / 100, true));
  return {
    panels, kw: Math.round(kw * 10) / 10, coverage, monthlyKwh: Math.round(monthlyKwh),
    sunHours: sun.sunHours, low, high, lowPct: Math.round(lo), highPct: Math.round(hi),
    small: high < 15, roofLimited, utility: u,
  };
}
