// Example data so the coach opens in a realistic state. Every record is marked
// sample and is wiped the moment the rep logs her first real chat.

import { CADENCE } from './content.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DAY = 86400000;

export function sampleData(now = new Date()) {
  const rand = rng(20261022);
  const taps = [];
  const spots = ['Entrance', 'Garden', 'Hardware', 'Lighting', 'Appliances'];
  const spotLift = { Entrance: 1.25, Garden: 1.1, Hardware: 0.85, Lighting: 0.95, Appliances: 1.05 };
  const openerLift = { o1: 1.2, o2: 1.05, o3: 1.4, o4: 0.95, o5: 1.0, o6: 0.7, o7: 0.85, o8: 0.9 };
  const openerIds = Object.keys(openerLift);
  // Shifts over the last 9 days: [days ago, start hour, end hour, store]
  const shifts = [[8, 16, 20, 'Store 1'], [7, 10, 16, 'Store 2'], [6, 9, 15, 'Store 1'], [5, 10, 14, 'Store 1'], [3, 16, 20, 'Store 2'], [2, 16, 20, 'Store 1'], [1, 10, 16, 'Store 1'], [0, 10, 13, 'Store 1']];
  for (const [ago, h0, h1, where] of shifts) {
    const base = new Date(now.getTime() - ago * DAY); base.setMinutes(0, 0, 0);
    const weekend = [0, 6].includes(base.getDay());
    const n = Math.round((h1 - h0) * (weekend ? 1.9 : 1.3));
    for (let k = 0; k < n; k++) {
      const t = new Date(base); t.setHours(h0, 0, 0, 0);
      t.setTime(t.getTime() + rand() * (h1 - h0) * 3600000);
      if (t > now) continue;
      const day = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(2026, 0, 1)) / 86400000);
      const o = openerIds[((day % openerIds.length) + openerIds.length) % openerIds.length];
      const spot = spots[Math.floor(rand() * spots.length)];
      const hour = t.getHours();
      const timeLift = (weekend && hour >= 11 && hour < 13) ? 1.35 : (hour >= 17 ? 1.1 : 1);
      const lift = openerLift[o] * spotLift[spot] * timeLift;
      const x = rand();
      const r = x < 0.11 * lift ? 'book' : x < 0.3 * lift ? 'maybe' : 'no';
      taps.push({ t: t.getTime(), o, r, spot, where, sample: true });
    }
  }
  taps.sort((a, b) => a.t - b.t);

  const at = (daysAgo, h = 18, m = 0) => { const d = new Date(now.getTime() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };
  const ahead = (days, h, m = 0) => { const d = new Date(now.getTime() + days * DAY); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const sentUpTo = (n, startAgo) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, at(startAgo - CADENCE[i], 18)]));

  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const maybes = [
    { id: 's-m1', first: 'Carmen', phone: '9095550147', tags: ['spouse'], address: '1234 Sample Ave, Fontana, CA 92335', start: at(0, 12, 20), consentAt: at(0, 12, 20), sent: {}, sample: true },
    { id: 's-m5', first: 'Ken', phone: '9515550136', tags: ['busy'], checkBack: ymd(now), checkNote: 'after your vacation', start: at(23, 15, 30), consentAt: at(23, 15, 30), sent: { 0: at(23, 18, 2) }, sample: true },
    { id: 's-m2', first: 'Lupe', phone: '9515550119', tags: ['roof'], start: at(2, 11, 5), consentAt: at(2, 11, 5), sent: { 0: at(2, 18, 10) }, sample: true },
    { id: 's-m3', first: 'Dev', phone: '9095550183', tags: ['cost'], start: at(7, 17, 40), consentAt: at(7, 17, 40), sent: { 0: at(7, 18, 30), 1: at(5, 18, 5) }, sample: true },
    { id: 's-m4', first: 'Tony', phone: '9515550162', tags: ['credit'], start: at(20, 15, 0), consentAt: at(20, 15, 0), sent: sentUpTo(4, 20), sample: true },
    { id: 's-m6', first: 'Grace', phone: '9095550129', tags: ['spouse'], start: at(12, 13, 0), consentAt: at(12, 13, 0), sent: sentUpTo(3, 12), booked: at(5, 19, 10), stopped: at(5, 19, 10), sample: true },
  ];

  const bookings = [
    { id: 's-b1', first: 'Maria', last: 'Garcia', phone: '9095550142', when: null, prefs: ['eve', 'sat'], type: 'visit', both: 'both', own: true, address: '5678 Example St, Rialto, CA 92376', bill: 260, utility: 'Southern California Edison', estimate: '17 panels (7 kW), 6.2 sun hours a day', src: 'No-time card', created: now.getTime() - 4 * 60000, sent: {}, sample: true },
    { id: 's-b2', first: 'James', last: 'Nguyen', phone: '9515550128', when: ahead(1, 10), type: 'call', both: 'one', src: 'Booth', created: at(3, 14), sent: { now: at(3, 14, 5) }, sample: true },
    { id: 's-b3', first: 'Rosa', last: 'Medina', phone: '9095550175', when: new Date(at(2, 17)).toISOString(), type: 'visit', both: 'both', src: 'Booth', created: at(6, 13), sent: { now: at(6, 13, 4), before: at(4, 18) }, outcome: 'showed', outcomeAt: at(2, 19), sample: true },
    { id: 's-b4', first: 'Hector', last: 'Ruiz', phone: '9515550153', when: new Date(at(4, 18, 30)).toISOString(), type: 'call', both: 'solo', src: 'Her link', created: at(7, 21, 40), sent: { now: at(7, 21, 45), before: at(5, 18) }, outcome: 'showed', outcomeAt: at(4, 19, 30), sample: true },
    { id: 's-b5', first: 'Dana', last: 'Kim', phone: '9095550188', when: new Date(at(3, 11)).toISOString(), type: 'visit', both: 'both', src: 'Booth', created: at(5, 15), sent: { now: at(5, 15, 3), before: at(4, 18) }, outcome: 'noshow', outcomeAt: at(3, 12), sample: true },
  ];

  // A sample pilot that started with the sample week, so the comparison has something to show.
  const pilotStart = new Date(now.getTime() - 8 * DAY);
  const pilot = { start: ymd(pilotStart), before: { shifts: 9, booked: 6, showed: 4, noshow: 2 }, sample: true };
  return { taps, maybes, bookings, pilot };
}
