// Everything the rep enters lives in this phone's browser storage and nowhere else.
// No server, no sync. Export makes a backup file the rep keeps on the same phone.

const KEY = 'suncheck.v1';

const blank = () => ({
  settings: {
    first: '',          // rep's first name, typed by the rep on this phone
    phone: '',          // rep's own mobile
    form: '',           // rep's own Google Form pre-filled link (requests land in her Sheet)
    company: '',        // left blank until the manager OKs naming the company
    store: '',          // left blank until the manager OKs naming the store
    reward: '',         // the current referral reward line, in the rep's words
    stores: ['Store 1', 'Store 2'],
    spots: ['Entrance', 'Garden', 'Hardware', 'Lighting', 'Appliances'],
  },
  ui: { spot: 'Entrance', where: 'Store 1' },
  taps: [],        // one per chat: { t, o (that day's opener id), r: 'book' | 'no' | 'maybe', spot, where, sample? }
  maybes: [],      // { id, first, phone, address, tags[], consentAt, consentText, start, sent{}, stopped, sample? }
  bookings: [],    // { id, first, last, phone, prefs[], when?, type, both, address, bill, src, ref, created, sent{}, sample? }
  edits: { openers: {}, answers: {} },
  samples: false,
});

let cache = null;

export function load() {
  if (cache) return cache;
  let data = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      data = { ...data, ...saved, settings: { ...data.settings, ...(saved.settings || {}) }, ui: { ...data.ui, ...(saved.ui || {}) }, edits: { openers: {}, answers: {}, ...(saved.edits || {}) } };
    }
  } catch (e) { /* storage blocked or corrupt: run with a fresh in-memory copy */ }
  cache = data;
  return data;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private mode: keep working in memory */ }
}

export function update(fn) {
  const d = load();
  fn(d);
  save();
  return d;
}

export function hasRealData(d = load()) {
  return d.taps.some(t => !t.sample) || d.maybes.some(m => !m.sample) || d.bookings.some(b => !b.sample);
}

export function clearSamples() {
  update(d => {
    d.taps = d.taps.filter(t => !t.sample);
    d.maybes = d.maybes.filter(m => !m.sample);
    d.bookings = d.bookings.filter(b => !b.sample);
    if (d.settings.pilot && d.settings.pilot.sample) delete d.settings.pilot;
    d.samples = false;
  });
}

export function clearAll() {
  cache = blank();
  save();
}

export function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !('settings' in parsed)) throw new Error('That file is not a Sun Check backup.');
  cache = { ...blank(), ...parsed };
  save();
}

// Ask the browser not to evict this data under storage pressure (best effort).
export async function keepData() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
}
