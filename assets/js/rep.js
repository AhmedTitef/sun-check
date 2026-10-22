// Pocket Coach: the rep's in-store helper. Runs entirely on her phone.

import { load, save, update, clearSamples, clearAll, exportJSON, importJSON, keepData } from './store.js';
import { OPENERS, ANSWERS, TAGS, PRACTICE_PROMPT, CADENCE } from './content.js';
import { maybeText, maybeDue, maybePlan, confirmNowText, confirmBeforeText, voiceMemoScript, neighborText, PREFS, prefsText } from './texts.js';
import { sampleData } from './sample.js';
import { $, $$, esc, uid, digits, fmtPhone, validPhone, fmtTime, fmtDay, fmtWhen, ago, smsHref, copyText, shareOrCopy, download, toast, sheet, pageLink, parseForm, ICONS, startOfDay, daysBetween } from './util.js';

const view = $('#view');
const RESULTS = { pass: 'Walked by', stop: 'Stopped', owner: 'Owner', book: 'Booked' };
const HINTS = { pass: 'no real chat', stop: 'talked, not owner', owner: 'owner, not yet', book: 'set a time' };
let peopleTab = 'maybe';
let weekOffset = 0;
const taskMode = {};

/* ---------- content with the rep's own edits ---------- */
const openers = () => { const e = load().edits.openers; return OPENERS.map(o => ({ ...o, ...(e[o.id] || {}) })); };
const answers = () => { const e = load().edits.answers; return ANSWERS.map(a => ({ ...a, ...(e[a.id] || {}) })); };

function fillNames(text) {
  const s = load().settings;
  return esc(text)
    .replace(/\[company\]/g, s.company ? esc(s.company) : '<span class="placeholder">[company]</span>')
    .replace(/\[store\]/g, s.store ? esc(s.store) : '<span class="placeholder">[store]</span>');
}

function realAction() {
  if (load().samples) { clearSamples(); toast('Sample data cleared. From here on it is all yours.'); }
}

const afterHours = (d = new Date()) => d.getHours() >= 21 || d.getHours() < 8;

/* ---------- counting ---------- */
function funnel(taps) {
  const n = r => taps.filter(t => t.r === r).length;
  const booked = n('book');
  const owners = booked + n('owner');
  const stopped = owners + n('stop');
  return { tries: taps.length, stopped, owners, booked, pass: n('pass'), stop: n('stop'), owner: n('owner'), book: booked };
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const todayTaps = () => { const s = startOfDay().getTime(); return load().taps.filter(t => t.t >= s); };

/* ---------- routing ---------- */
const routes = { coach: renderCoach, tonight: renderTonight, people: renderPeople, stats: renderStats, more: renderMore };
function route() {
  const tab = (location.hash || '#coach').slice(1).split('/')[0];
  const key = routes[tab] ? tab : 'coach';
  $$('.tabs a').forEach(a => { if (a.dataset.tab === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  routes[key]();
  updateBadge();
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

function updateBadge() {
  const n = tasks().length;
  const b = $('[data-badge="tonight"]');
  if (b) { b.hidden = !n; b.textContent = n; }
}

function sampleNotice() {
  return load().samples
    ? `<div class="notice compact"><span>Sample data. It clears when you log your first real chat.</span><button class="linkbtn small" type="button" data-act="clear-samples">Clear</button></div>`
    : '';
}

/* ---------- Coach ---------- */
function renderCoach() {
  const d = load();
  const list = openers();
  const i = Math.min(d.ui.opener, list.length - 1);
  const o = list[i];
  const f = funnel(todayTaps());
  view.innerHTML = `
    ${sampleNotice()}
    <div class="coachbar">
      <button class="chip on" type="button" data-act="where" aria-label="Store: ${esc(d.ui.where)}. Tap to change">${esc(d.ui.where)}</button>
      <button class="chip" type="button" data-act="spot" aria-label="Spot: ${esc(d.ui.spot)}. Tap to change">${esc(d.ui.spot)}</button>
      <button class="codebtn" type="button" data-act="code"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm3 3h2v2h-2zm2-3h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3z"/></svg>My code</button>
    </div>
    <article class="opener" aria-live="polite">
      <div class="opener-top">
        <span class="opener-count">Opener ${i + 1} of ${list.length}</span>
        <div class="opener-nav">
          <button type="button" data-act="prev" aria-label="Previous opener">${ICONS.back}</button>
          <button type="button" data-act="next" aria-label="Next opener">${ICONS.next}</button>
        </div>
      </div>
      <p class="opener-line">${esc(o.line)}</p>
      <p class="opener-why">${esc(o.why)}</p>
      <div class="opener-foot">
        <div class="opener-dots" aria-hidden="true">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <button class="linkbtn" type="button" data-act="edit-opener">Edit</button>
      </div>
    </article>
    <section class="section" aria-labelledby="score-h">
      <h2 class="section-title" id="score-h">After each chat, tap one</h2>
      <div class="score-grid">
        ${Object.entries(RESULTS).map(([r, label]) => `<button class="score-btn" type="button" data-r="${r}"><span>${label}<small>${HINTS[r]}</small></span><span class="count" aria-label="${f[r]} today">${f[r]}</span></button>`).join('')}
      </div>
      <p class="today">Today: <b>${f.tries}</b> tries, <b>${f.stopped}</b> stopped, <b>${f.owners}</b> owners, <b>${f.booked}</b> booked${f.tries ? ` <button class="linkbtn small" type="button" data-act="undo">Undo last</button>` : ''}</p>
    </section>
    <div class="quick">
      <button class="btn code" type="button" data-act="code"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm3 3h2v2h-2zm2-3h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3z"/></svg>Show my code</button>
      <button class="btn lemon" type="button" data-act="maybe">${ICONS.plus} Maybe</button>
    </div>
    <section class="section said" aria-labelledby="said-h">
      <h2 class="section-title" id="said-h">They said…</h2>
      <div class="chips">${answers().map(a => `<button class="chip" type="button" data-answer="${a.id}">${esc(a.label)}</button>`).join('')}</div>
    </section>
`;
}

// The main way to share: a full-screen code on the rep's own phone that a
// shopper can scan from about a meter away. Built on the phone, so it works offline.
let wakeLock = null;
async function holdScreen() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
}
function onVisible() { if (document.visibilityState === 'visible' && $('.codescreen')) holdScreen(); }

function showCode() {
  const st = load().settings;
  const link = pageLink(st, { s: 'q' });
  const el = document.createElement('div');
  el.className = 'codescreen';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Your code');
  el.innerHTML = `<div class="big">${qrSvg(link, { ec: 'L', color: '#000', quiet: 3 })}</div>
    <div class="cap"><span>Point your camera here to see your roof and pick a time, on your own phone.</span>
    ${st.first ? `<small>${esc(st.first)} at the solar booth</small>` : '<small>Add your first name in More so the page says who you are.</small>'}
    <button type="button" data-close>Done</button></div>`;
  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisible);
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  el.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisible);
  document.body.appendChild(el);
  el.querySelector('[data-close]').focus();
  holdScreen();
}

function logTap(r, btn) {
  realAction();
  const d = load();
  const o = openers()[Math.min(d.ui.opener, OPENERS.length - 1)];
  const tap = { t: Date.now(), o: o.id, r, spot: d.ui.spot, where: d.ui.where };
  update(x => x.taps.push(tap));
  renderCoach();
  const again = $(`.score-btn[data-r="${r}"]`);
  if (again) { again.classList.add('pop'); setTimeout(() => again.classList.remove('pop'), 500); }
  if (navigator.vibrate) navigator.vibrate(12);
  const action = r === 'book' ? { label: 'Add for reminders', run: () => addBooking({ src: 'Booth' }) }
    : r === 'owner' ? { label: 'Add maybe', run: () => addMaybe() }
    : { label: 'Undo', run: () => undoTap(tap.t) };
  toast(`${RESULTS[r]}, opener ${OPENERS.findIndex(x => x.id === o.id) + 1}`, action);
}

function undoTap(t) {
  update(d => {
    const idx = t ? d.taps.findIndex(x => x.t === t) : d.taps.length - 1;
    if (idx >= 0) d.taps.splice(idx, 1);
  });
  renderCoach();
  toast('Removed the last tap');
}

function pickFrom(title, options, current, onPick) {
  const s = sheet({
    title,
    body: `<div class="chips">${options.map(v => `<button class="chip" type="button" data-v="${esc(v)}" aria-pressed="${v === current}">${esc(v)}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:.9rem">Change the list in More, under Stores and spots.</p>`,
  });
  s.body.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    onPick(b.dataset.v);
    s.close();
  });
}

function openAnswer(id) {
  const a = answers().find(x => x.id === id);
  if (!a) return;
  const s = sheet({
    title: a.label,
    body: `<div class="say"><div class="say-label">Say</div>${fillNames(a.say)}</div>
      ${a.next ? `<div class="then"><div class="then-label">Then</div><div>${fillNames(a.next)}</div></div>` : ''}
      <div class="sheet-actions"><button class="btn ghost small" type="button" data-act="edit">${ICONS.edit} Edit to match my training</button></div>`,
  });
  s.body.querySelector('[data-act="edit"]').addEventListener('click', () => { s.close(); editAnswer(id); });
}

function editAnswer(id) {
  const a = answers().find(x => x.id === id);
  const base = ANSWERS.find(x => x.id === id);
  const s = sheet({
    title: 'Edit answer',
    body: `<form class="form">
      <label class="field"><span>What they say</span><input class="input" id="ea-label" value="${esc(a.label)}"></label>
      <label class="field"><span>What you say</span><textarea class="textarea" id="ea-say">${esc(a.say)}</textarea></label>
      <label class="field"><span>Then (a note for you)</span><textarea class="textarea" id="ea-next" style="min-height:5rem">${esc(a.next || '')}</textarea></label>
      <p class="small muted">Keep it to one or two lines you can say out loud. No savings promises; point to the consultant for numbers.</p>
      <div class="btnrow"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="reset">Reset to default</button></div>
    </form>`,
  });
  const form = s.body.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    update(d => { d.edits.answers[id] = { label: $('#ea-label').value.trim() || base.label, say: $('#ea-say').value.trim() || base.say, next: $('#ea-next').value.trim() }; });
    s.close(); toast('Answer saved on this phone'); route();
  });
  s.body.querySelector('[data-act="reset"]').addEventListener('click', () => {
    update(d => { delete d.edits.answers[id]; }); s.close(); toast('Back to the default answer'); route();
  });
}

function editOpener() {
  const d = load();
  const list = openers();
  const i = Math.min(d.ui.opener, list.length - 1);
  const o = list[i];
  const base = OPENERS[i];
  const s = sheet({
    title: `Edit opener ${i + 1}`,
    body: `<form class="form">
      <label class="field"><span>The line</span><textarea class="textarea" id="eo-line" style="min-height:5rem">${esc(o.line)}</textarea></label>
      <label class="field"><span>Why it works (a note for you)</span><textarea class="textarea" id="eo-why" style="min-height:5rem">${esc(o.why)}</textarea></label>
      <div class="btnrow"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="reset">Reset to default</button></div>
    </form>`,
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    update(x => { x.edits.openers[base.id] = { line: $('#eo-line').value.trim() || base.line, why: $('#eo-why').value.trim() }; });
    s.close(); toast('Opener saved on this phone'); renderCoach();
  });
  s.body.querySelector('[data-act="reset"]').addEventListener('click', () => {
    update(x => { delete x.edits.openers[base.id]; }); s.close(); toast('Back to the default opener'); renderCoach();
  });
}

/* ---------- Maybe: a ten-second add ---------- */
function consentLine(settings) {
  const who = settings.first ? settings.first.trim() : 'the rep';
  const co = settings.company ? settings.company.trim() : '[company]';
  return `Yes, ${who} with ${co} may text me about solar at the number above. Up to 6 texts over 2 months, sent by hand. Reply STOP anytime. Agreeing isn't required to buy anything.`;
}

function addMaybe() {
  const st = load().settings;
  const line = consentLine(st);
  const s = sheet({
    title: 'Add a maybe',
    body: `<form class="form" novalidate>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" id="m-first" autocomplete="off" autocapitalize="words" enterkeyhint="next" autofocus></label>
        <label class="field"><span>Mobile</span><input class="input" id="m-phone" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div class="field"><span>Why not today? Tap one</span>
        <div class="chips" id="m-tags">${TAGS.map(t => `<button class="chip" type="button" data-tag="${t.id}" aria-pressed="false">${t.label}</button>`).join('')}</div>
      </div>
      <div class="field"><span>Check back (optional)</span>
        <div class="chips" id="m-cb">
          <button class="chip" type="button" data-cb="month" aria-pressed="false">In a month</button>
          <button class="chip" type="button" data-cb="holidays" aria-pressed="false">After the holidays</button>
          <button class="chip" type="button" data-cb="three" aria-pressed="false">In 3 months</button>
          <button class="chip" type="button" data-cb="pick" aria-pressed="false">Pick a date</button>
        </div>
        <input class="input" id="m-cbdate" type="date" hidden>
      </div>
      <label class="field"><span>Street and ZIP (optional)</span><input class="input" id="m-addr" autocomplete="off" placeholder="1234 Orchard Ave, 92335"><small class="small muted">Their texts then open with their own roof ready.</small></label>
      <div class="consent">
        <p class="handoff">Hand them your phone for this box, so the OK is theirs.</p>
        <label class="check"><input type="checkbox" id="m-ok"><span>${fillNames(line)}</span></label>
      </div>
      <p class="small muted" id="m-err" role="alert"></p>
      <button class="btn wide" type="submit">Save to maybe list</button>
    </form>`,
  });
  const tags = new Set();
  let checkBack = null;
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.body.querySelector('#m-cb').addEventListener('click', e => {
    const b = e.target.closest('[data-cb]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('#m-cb .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    const dateInput = $('#m-cbdate');
    dateInput.hidden = true;
    checkBack = null;
    if (!on) return;
    b.setAttribute('aria-pressed', 'true');
    const now = new Date();
    if (b.dataset.cb === 'month') { const d = new Date(now); d.setMonth(d.getMonth() + 1); checkBack = { date: ymd(d), note: 'in about a month' }; }
    if (b.dataset.cb === 'three') { const d = new Date(now); d.setMonth(d.getMonth() + 3); checkBack = { date: ymd(d), note: 'in a few months' }; }
    if (b.dataset.cb === 'holidays') { const y = now.getMonth() === 0 && now.getDate() < 6 ? now.getFullYear() : now.getFullYear() + 1; checkBack = { date: `${y}-01-06`, note: 'after the holidays' }; }
    if (b.dataset.cb === 'pick') { dateInput.hidden = false; dateInput.min = ymd(now); dateInput.focus(); }
  });
  s.body.querySelector('#m-cbdate').addEventListener('change', e => {
    const v = e.target.value;
    checkBack = v ? { date: v, note: `around ${new Date(`${v}T12:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` } : null;
  });
  s.body.querySelector('#m-tags').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('#m-tags .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    tags.clear();
    if (on) { b.setAttribute('aria-pressed', 'true'); tags.add(b.dataset.tag); }
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('#m-first').value.trim();
    const phone = $('#m-phone').value;
    const err = $('#m-err');
    if (!first) { err.textContent = 'Add their first name.'; return; }
    if (!validPhone(phone)) { err.textContent = 'That mobile number needs 10 digits.'; return; }
    if (!$('#m-ok').checked) { err.textContent = 'They need to tick the box before you can text them.'; return; }
    realAction();
    const now = Date.now();
    update(d => d.maybes.unshift({ id: uid(), first, phone: digits(phone), address: $('#m-addr').value.trim(), tags: [...tags], checkBack: checkBack && checkBack.date, checkNote: checkBack && checkBack.note, start: now, consentAt: now, consentText: line, sent: {}, stopped: false }));
    s.close();
    toast(`${first} is on the maybe list. The first text is ready in Tonight.`, { label: 'Open', run: () => { location.hash = '#tonight'; } });
    route();
  });
}

/* ---------- Bookings ---------- */
function addBooking(prefill = {}) {
  const tomorrow = new Date(Date.now() + 86400000);
  const dateVal = tomorrow.toISOString().slice(0, 10);
  const s = sheet({
    title: 'Add a booking',
    body: `<form class="form" novalidate>
      <p class="small muted">For reminders from your phone. Enter it in the company tablet as usual.</p>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" id="b-first" autocapitalize="words" autofocus></label>
        <label class="field"><span>Last name</span><input class="input" id="b-last" autocapitalize="words"></label>
      </div>
      <label class="field"><span>Mobile</span><input class="input" id="b-phone" type="tel" inputmode="tel"></label>
      <div class="field"><span>Time</span><div class="seg" id="b-has"><button type="button" data-v="set" aria-pressed="${prefill.prefs ? 'false' : 'true'}">Set in the tablet</button><button type="button" data-v="pref" aria-pressed="${prefill.prefs ? 'true' : 'false'}">Not set yet</button></div></div>
      <div class="row2" id="b-when" ${prefill.prefs ? 'hidden' : ''}>
        <label class="field"><span>Day</span><input class="input" id="b-date" type="date" value="${dateVal}"></label>
        <label class="field"><span>Time</span><input class="input" id="b-time" type="time" value="18:00" step="900"></label>
      </div>
      <div class="field" id="b-prefs" ${prefill.prefs ? '' : 'hidden'}><span>They prefer</span><div class="chips">${Object.entries(PREFS).map(([k, v]) => `<button class="chip" type="button" data-pref="${k}" aria-pressed="false">${v}</button>`).join('')}</div></div>
      <div class="field"><span>How they'll meet</span><div class="seg" id="b-type"><button type="button" data-v="visit" aria-pressed="true">Consultant visits</button><button type="button" data-v="call" aria-pressed="false">Phone or video</button></div></div>
      <div class="field"><span>Who will be there</span><div class="seg" id="b-both"><button type="button" data-v="both" aria-pressed="true">Both owners</button><button type="button" data-v="solo" aria-pressed="false">Sole owner</button><button type="button" data-v="one" aria-pressed="false">One of two</button></div></div>
      <label class="field"><span>Came from</span><select class="input" id="b-src">${['Booth', 'After-hours page', 'No-time card', 'Neighbor link', 'Maybe list', 'Door hanger', 'Social post'].map(v => `<option ${v === (prefill.src || 'Booth') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <p class="small muted" id="b-err" role="alert"></p>
      <button class="btn wide" type="submit">Save booking</button>
    </form>`,
  });
  const segs = ['#b-type', '#b-both', '#b-has'];
  segs.forEach(sel => s.body.querySelector(sel).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$(`${sel} button`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (sel === '#b-has') { $('#b-when').hidden = b.dataset.v !== 'set'; $('#b-prefs').hidden = b.dataset.v !== 'pref'; }
  }));
  s.body.querySelector('#b-prefs').addEventListener('click', e => {
    const c = e.target.closest('[data-pref]'); if (!c) return;
    c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('#b-first').value.trim();
    const phone = $('#b-phone').value;
    const err = $('#b-err');
    if (!first) { err.textContent = 'Add their first name.'; return; }
    if (!validPhone(phone)) { err.textContent = 'That mobile number needs 10 digits.'; return; }
    const pick = sel => $(`${sel} [aria-pressed="true"]`).dataset.v;
    const hasTime = pick('#b-has') === 'set';
    const when = hasTime ? new Date(`${$('#b-date').value}T${$('#b-time').value || '18:00'}`) : null;
    if (hasTime && isNaN(when)) { err.textContent = 'Pick a day and time.'; return; }
    const prefs = $$('#b-prefs [aria-pressed="true"]').map(c => c.dataset.pref);
    realAction();
    update(d => d.bookings.unshift({ id: uid(), first, last: $('#b-last').value.trim(), phone: digits(phone), when: when ? when.toISOString() : null, prefs, type: pick('#b-type'), both: pick('#b-both'), src: $('#b-src').value, created: Date.now(), sent: {} }));
    s.close();
    toast(`${first} saved. Text them within 5 minutes.`, { label: 'Open', run: () => { location.hash = '#tonight'; } });
    route();
  });
}

function setTime(b) {
  const d0 = new Date(Date.now() + 86400000);
  const s = sheet({
    title: `${b.first}'s time`,
    body: `<form class="form">
      <p class="small muted">Once they reply, set the time you booked in the tablet. The day-before confirm lines up from it.</p>
      <div class="row2">
        <label class="field"><span>Day</span><input class="input" id="t-date" type="date" value="${(b.when ? new Date(b.when) : d0).toISOString().slice(0, 10)}"></label>
        <label class="field"><span>Time</span><input class="input" id="t-time" type="time" value="${b.when ? new Date(b.when).toTimeString().slice(0, 5) : '18:00'}" step="900"></label>
      </div>
      <button class="btn wide" type="submit">Save time</button>
    </form>`,
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const when = new Date(`${$('#t-date').value}T${$('#t-time').value}`);
    if (isNaN(when)) return;
    update(d => { const x = d.bookings.find(y => y.id === b.id); if (x) x.when = when.toISOString(); });
    s.close(); toast(`${b.first}: ${fmtWhen(when)}`); route();
  });
}

function bookingCard(b) {
  const row = (k, v) => v ? `<div class="fieldcopy"><span>${k}</span><span>${esc(v)}</span><button type="button" data-copy="${esc(v)}" aria-label="Copy ${k}">${ICONS.copy}</button></div>` : '';
  const s = sheet({
    title: `${b.first} ${b.last || ''}`.trim(),
    body: `<p class="small muted" style="margin-bottom:.6rem">Everything you need to enter it in the company tablet.</p>
      ${row('First name', b.first)}${row('Last name', b.last)}${row('Mobile', fmtPhone(b.phone))}${row('Email', b.email)}${b.when ? row('When', `${fmtDay(b.when)}, ${fmtTime(b.when)}`) : row('Prefers', prefsText(b.prefs) || 'Any time')}
      ${row('Meeting', b.type === 'call' ? 'Phone or video' : 'Consultant visits')}${row('Owners there', b.both === 'both' ? 'Both owners' : b.both === 'one' ? 'One of two owners' : 'Sole owner')}
      ${row('Address', b.address)}${row('Monthly bill', b.bill ? `$${b.bill}` : '')}${row('Came from', b.src)}${row('Referred by', b.ref)}
      ${row('Owns the home', b.own === false ? 'No' : b.own ? 'Yes' : '')}${row('Utility', b.utility)}${row('Estimate shown', b.estimate)}
      <div class="sheet-actions"><button class="btn small" type="button" data-act="time">${b.when ? 'Change time' : 'Set the time'}</button><button class="btn ghost small" type="button" data-act="del">Delete</button></div>`,
  });
  s.body.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]');
    if (c) { (await copyText(c.dataset.copy)) ? toast('Copied') : toast('Copy blocked. Press and hold to copy.'); }
    if (e.target.closest('[data-act="time"]')) { s.close(); return setTime(b); }
    if (e.target.closest('[data-act="del"]')) { update(d => { d.bookings = d.bookings.filter(x => x.id !== b.id); }); s.close(); toast('Booking deleted'); route(); }
  });
}

/* ---------- Tonight ---------- */
function tasks(now = new Date()) {
  const d = load();
  const list = [];
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  for (const b of d.bookings) {
    const sent = b.sent || {};
    if (!b.when) {
      if (!sent.now) list.push({ kind: 'now', b, pri: 0, key: `${b.id}:now` });
      else list.push({ kind: 'settime', b, pri: 1.5, key: `${b.id}:settime` });
      continue;
    }
    const when = new Date(b.when);
    if (!sent.now && when > now) list.push({ kind: 'now', b, pri: 0, key: `${b.id}:now` });
    const days = daysBetween(now, when);
    if (!sent.before && when > now && days >= 1 && days <= 2) list.push({ kind: 'before', b, pri: 1, key: `${b.id}:before` });
    if (!sent.neighbor && when < now && daysBetween(when, now) >= 1 && daysBetween(when, now) <= 21) list.push({ kind: 'neighbor', b, pri: 3, key: `${b.id}:neighbor` });
  }
  for (const m of d.maybes) {
    const due = maybeDue(m);
    if (due && due.due <= endToday) list.push({ kind: 'maybe', m, step: due.step, index: due.index, total: due.total, pri: 2, key: `${m.id}:${due.step}` });
  }
  return list.sort((a, b) => a.pri - b.pri);
}

function taskText(t, st) {
  if (t.kind === 'now') return confirmNowText(t.b, st);
  if (t.kind === 'before') return taskMode[t.key] === 'memo' ? voiceMemoScript(t.b, st) : confirmBeforeText(t.b, st);
  if (t.kind === 'neighbor') return neighborText(t.b, st);
  return maybeText(t.step, t.m, st);
}

function renderTonight() {
  const st = load().settings;
  const list = tasks();
  const late = afterHours();
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const head = `<header class="vhead"><h1>Tonight</h1><p>${day}. ${list.length ? `${list.length} text${list.length === 1 ? '' : 's'} to send, one tap each.` : 'Nothing due.'}</p></header>`;
  const lateNote = late ? `<div class="notice"><span>It's after 9 PM. Texts wait until 8 AM; the law sets texting hours at 8 AM to 9 PM.</span></div>` : '';
  const noName = !st.first ? `<div class="notice"><span>Add your first name in More so texts say who they're from.</span><a class="btn small ghost" href="#more">Add it</a></div>` : '';
  if (!list.length) {
    view.innerHTML = `${sampleNotice()}${head}${noName}
      <div class="empty">
        <svg class="moon" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="var(--label-bg)"/><path d="M41 44a16 16 0 1 1-8-30 13 13 0 0 0 8 30z" fill="#f4cc2a"/><circle cx="17" cy="19" r="1.6" fill="#fff"/><circle cx="48" cy="24" r="1.2" fill="#fff"/><circle cx="45" cy="13" r="1" fill="#fff"/></svg>
        <h3>All caught up</h3>
        <p class="muted">New bookings, day-before confirms, maybe-list texts and neighbor links show up here when they're due.</p>
        <div class="btnrow"><button class="btn small" type="button" data-act="maybe">${ICONS.plus} Add a maybe</button><button class="btn small ghost" type="button" data-act="add-booking">${ICONS.plus} Add a booking</button></div>
      </div>`;
    return;
  }
  const tag = t => ({
    now: `<span class="tag hot">${t.b && t.b.when ? 'New booking' : 'New request'}: reply within 5 min</span>`,
    settime: `<span class="tag">Waiting on their reply</span>`,
    before: `<span class="tag stick">Make it stick: confirm ${daysBetween(new Date(), t.b && t.b.when) === 1 ? 'tomorrow\'s' : 'this'} visit</span>`,
    maybe: t.step === 'cb' ? `<span class="tag maybe">Check-back day</span>` : `<span class="tag maybe">Maybe: text ${(t.index || 0) + 1} of ${t.total || CADENCE.length}</span>`,
    neighbor: `<span class="tag neighbor">Neighbor link</span>`,
  }[t.kind]);
  const who = t => t.b || t.m;
  const meta = t => {
    if (t.kind === 'now' && !t.b.when) return `Asked ${ago(t.b.created)}${t.b.prefs && t.b.prefs.length ? `. Prefers ${prefsText(t.b.prefs).toLowerCase()}` : ''}. Fill in two times from the tablet.`;
    if (t.kind === 'now') return `Booked ${ago(t.b.created)} for ${fmtWhen(t.b.when)}`;
    if (t.kind === 'settime') return `You texted times ${ago(t.b.sent.now)}. Set the time once they pick one.`;
    if (t.kind === 'before') return `${fmtWhen(t.b.when)}, ${t.b.type === 'call' ? 'phone or video' : 'consultant visits'}`;
    if (t.kind === 'neighbor') return `Their visit was ${fmtDay(t.b.when)}`;
    const tg = (t.m.tags || [])[0];
    const why = tg ? `, reason: ${TAGS.find(x => x.id === tg)?.label.toLowerCase()}` : '';
    if (t.step === 'cb') return `Said "check back ${t.m.checkNote || 'later'}" ${ago(t.m.start)}${why}`;
    return `Said maybe ${ago(t.m.start)}${why}${t.m.address ? '. Their link opens with their roof ready' : ''}`;
  };
  view.innerHTML = `${sampleNotice()}${head}${lateNote}${noName}
    <div class="queue">${list.map(t => {
      const p = who(t);
      if (t.kind === 'settime') {
        return `<article class="task" data-key="${t.key}">
          <div class="task-top">${tag(t)}</div>
          <div><h3>${esc(p.first)}${p.last ? ` ${esc(p.last[0])}.` : ''}</h3><p class="meta">${esc(meta(t))}</p></div>
          <div class="task-actions"><button class="btn" type="button" data-settime>Set the time</button><button class="btn ghost" type="button" data-details>Details</button></div>
        </article>`;
      }
      const text = taskText(t, st);
      const memo = t.kind === 'before' && taskMode[t.key] === 'memo';
      return `<article class="task" data-key="${t.key}">
        <div class="task-top">${tag(t)}${t.kind === 'before' ? `<div class="seg" role="group" aria-label="Send as"><button type="button" data-mode="text" aria-pressed="${!memo}">Text</button><button type="button" data-mode="memo" aria-pressed="${memo}">Voice memo</button></div>` : ''}</div>
        <div><h3>${esc(p.first)}${p.last ? ` ${esc(p.last[0])}.` : ''}</h3><p class="meta">${esc(meta(t))}</p></div>
        ${memo
          ? `<p class="small muted">Read this into a voice message in Messages. About 20 seconds.</p><div class="script">${esc(text)}</div>`
          : `<label class="sr-only" for="ta-${t.key}">Message to ${esc(p.first)}</label><textarea class="textarea" id="ta-${t.key}" data-draft>${esc(text)}</textarea>`}
        <div class="task-actions">
          ${late ? `<span class="btn ghost" aria-disabled="true">Send after 8 AM</span>` : `<a class="btn" data-sms href="${esc(smsHref(p.phone, memo ? '' : text))}">${memo ? ICONS.mic : ICONS.sms} ${memo ? 'Open Messages' : `Text ${esc(p.first)}`}</a>`}
          <button class="btn ghost" type="button" data-done>${ICONS.check} Sent</button>
        </div>
        <div class="task-actions">
          ${t.kind === 'now' ? `<button class="linkbtn" type="button" data-details>Details for the tablet</button>` : ''}
          ${t.kind === 'maybe' ? `<button class="linkbtn" type="button" data-skip>Tomorrow</button><button class="linkbtn" type="button" data-stop>They said stop</button>` : `<button class="linkbtn" type="button" data-skip>Skip</button>`}
        </div>
      </article>`;
    }).join('')}</div>`;
  view.querySelectorAll('[data-draft]').forEach(ta => ta.addEventListener('input', () => {
    const card = ta.closest('.task');
    const t = list.find(x => x.key === card.dataset.key);
    const a = card.querySelector('[data-sms]');
    if (a) a.href = smsHref(who(t).phone, ta.value);
  }));
  view.querySelectorAll('.task').forEach(card => card.addEventListener('click', e => {
    const t = list.find(x => x.key === card.dataset.key);
    if (!t) return;
    const modeBtn = e.target.closest('[data-mode]');
    if (modeBtn) { taskMode[t.key] = modeBtn.dataset.mode; renderTonight(); return; }
    if (e.target.closest('[data-done]')) return markSent(t);
    if (e.target.closest('[data-settime]')) return setTime(t.b);
    if (e.target.closest('[data-details]')) return bookingCard(t.b);
    if (e.target.closest('[data-skip]')) return skipTask(t);
    if (e.target.closest('[data-stop]')) return stopMaybe(t.m);
  }));
}

function markSent(t) {
  realActionKeep();
  const at = Date.now();
  update(d => {
    if (t.b) { const b = d.bookings.find(x => x.id === t.b.id); if (b) { b.sent = b.sent || {}; b.sent[t.kind] = at; } }
    if (t.m) { const m = d.maybes.find(x => x.id === t.m.id); if (m) { m.sent = m.sent || {}; m.sent[t.step] = at; } }
  });
  renderTonight(); updateBadge();
  toast('Marked sent', { label: 'Undo', run: () => {
    update(d => {
      if (t.b) { const b = d.bookings.find(x => x.id === t.b.id); if (b) delete b.sent[t.kind]; }
      if (t.m) { const m = d.maybes.find(x => x.id === t.m.id); if (m) delete m.sent[t.step]; }
    });
    renderTonight(); updateBadge();
  } });
}

// Marking a sample text as sent shouldn't wipe the samples; only new records do.
function realActionKeep() {}

function skipTask(t) {
  if (t.m) {
    update(d => { const m = d.maybes.find(x => x.id === t.m.id); if (m) m.start = (m.start || Date.now()) + 86400000; });
    toast('Moved to tomorrow');
  } else {
    update(d => { const b = d.bookings.find(x => x.id === t.b.id); if (b) { b.sent = b.sent || {}; b.sent[t.kind] = -1; } });
    toast('Skipped');
  }
  renderTonight(); updateBadge();
}

function stopMaybe(m) {
  update(d => { const x = d.maybes.find(y => y.id === m.id); if (x) { x.stopped = Date.now(); } });
  toast(`${m.first} won't get more texts`);
  route();
}

/* ---------- People ---------- */
function renderPeople() {
  const d = load();
  const maybes = d.maybes;
  const bookings = [...d.bookings].sort((a, b) => (a.when ? new Date(a.when).getTime() : 0) - (b.when ? new Date(b.when).getTime() : 0));
  const seg = `<div class="seg" role="tablist" aria-label="People">
    <button type="button" role="tab" data-ptab="maybe" aria-pressed="${peopleTab === 'maybe'}">Maybe list (${maybes.filter(m => !m.stopped).length})</button>
    <button type="button" role="tab" data-ptab="booked" aria-pressed="${peopleTab === 'booked'}">Booked (${bookings.length})</button></div>`;
  let body = '';
  if (peopleTab === 'maybe') {
    body = maybes.length ? `<div class="list">${maybes.map(m => {
      const due = maybeDue(m);
      const plan = maybePlan(m);
      const sentCount = plan.filter(p => m.sent && m.sent[p.step]).length;
      const dots = plan.map(p => `<i class="${m.sent && m.sent[p.step] ? 'on' : (due && due.step === p.step ? 'next' : '')}"></i>`).join('');
      const label = due ? (due.step === 'cb' ? 'Check-back text' : `Text ${due.index + 1}`) : '';
      const status = m.stopped ? 'Stopped. No more texts.' : due ? `${label} ${daysBetween(new Date(), due.due) <= 0 ? 'due today' : `on ${fmtDay(due.due)}`}` : 'All texts sent';
      return `<article class="person">
        <div class="person-top"><h3>${esc(m.first)}</h3><span class="meta">${fmtPhone(m.phone)}</span></div>
        <div class="dots" aria-label="${sentCount} of ${plan.length} texts sent">${dots}</div>
        <p class="meta">${esc(status)}. OK to text given ${fmtDay(m.consentAt)}.</p>
        ${m.tags && m.tags.length ? `<div class="minitags">${m.tags.map(t => `<span>${esc(TAGS.find(x => x.id === t)?.label || t)}</span>`).join('')}</div>` : ''}
        <div class="person-actions">${!m.stopped ? `<button class="btn small ghost" type="button" data-stopm="${m.id}">They said stop</button>` : ''}<button class="btn small ghost" type="button" data-delm="${m.id}">Delete</button></div>
      </article>`;
    }).join('')}</div>` : `<div class="empty"><h3>No maybes yet</h3><p class="muted">When an owner says "not today", tap Maybe and let them tick the OK-to-text box. Six friendly texts over eight weeks follow, each one sent by you.</p></div>`;
    body += `<button class="btn wide lemon" type="button" data-act="maybe">${ICONS.plus} Add a maybe</button>`;
  } else {
    body = bookings.length ? `<div class="list">${bookings.map(b => {
      const s = b.sent || {};
      const past = b.when && new Date(b.when) < new Date();
      const steps = [['now', 'Texted'], ['before', 'Day-before confirm'], ['neighbor', 'Neighbor link']].map(([k, l]) => `<span style="${s[k] > 0 ? '' : 'opacity:.45'}">${s[k] > 0 ? '✓ ' : ''}${l}</span>`).join('');
      const whenText = b.when ? `${past ? 'Was ' : ''}${fmtDay(b.when)}, ${fmtTime(b.when)}` : `Time not set${b.prefs && b.prefs.length ? `: ${prefsText(b.prefs).toLowerCase()}` : ''}`;
      return `<article class="person">
        <div class="person-top"><h3>${esc(b.first)} ${esc(b.last || '')}</h3><span class="meta">${esc(whenText)}</span></div>
        <p class="meta">${b.type === 'call' ? 'Phone or video' : 'Consultant visits'}. ${b.both === 'both' ? 'Both owners' : b.both === 'one' ? 'One of two owners' : 'Sole owner'}. From: ${esc(b.src || 'Booth')}${b.ref ? `, sent by ${esc(b.ref)}` : ''}.</p>
        <div class="minitags">${steps}</div>
        <div class="person-actions"><button class="btn small ghost" type="button" data-book="${b.id}">Details for the tablet</button></div>
      </article>`;
    }).join('')}</div>` : `<div class="empty"><h3>No bookings yet</h3><p class="muted">Add bookings from the booth or from your Google Calendar booking emails, and the confirm texts line up in Tonight.</p></div>`;
    body += `<button class="btn wide" type="button" data-act="add-booking">${ICONS.plus} Add a booking</button>`;
  }
  view.innerHTML = `${sampleNotice()}<header class="vhead"><h1>People</h1><p>Only on this phone. Delete anyone who asks.</p></header>${seg}${body}`;
}

/* ---------- Week ---------- */
function renderStats() {
  const d = load();
  const end = Date.now() - weekOffset * 7 * 86400000;
  const start = end - 7 * 86400000;
  const taps = d.taps.filter(t => t.t >= start && t.t < end);
  const f = funnel(taps);
  const ops = openers();
  const label = weekOffset ? 'The 7 days before that' : 'Last 7 days';

  const byOpener = ops.map((o, i) => ({ o, i, ...funnel(taps.filter(t => t.o === o.id)) })).filter(x => x.tries);
  const rank = (a, b) => (b.booked / b.tries) - (a.booked / a.tries) || (b.owners / b.tries) - (a.owners / a.tries);
  const enough = byOpener.filter(x => x.tries >= 8);
  const bestO = [...(enough.length ? enough : byOpener)].sort(rank)[0];

  const blocks = [[9, 11], [11, 13], [13, 15], [15, 17], [17, 19], [19, 21]];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cell = (di, [h0, h1]) => funnel(taps.filter(t => { const x = new Date(t.t); return (x.getDay() + 6) % 7 === di && x.getHours() >= h0 && x.getHours() < h1; }));
  const grid = days.map((_, di) => blocks.map(b => cell(di, b)));
  let bestCell = null;
  grid.forEach((row, di) => row.forEach((c, bi) => {
    if (c.tries < 4) return;
    const score = c.booked * 3 + c.owners;
    if (!bestCell || score / c.tries > bestCell.score) bestCell = { di, bi, score: score / c.tries, c };
  }));
  const spots = [...new Set(taps.map(t => t.spot))].map(spot => ({ spot, ...funnel(taps.filter(t => t.spot === spot)) })).sort((a, b) => (b.owners / b.tries) - (a.owners / a.tries));
  const bestS = spots.find(s => s.tries >= 8) || spots[0];
  const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  const seq = r => r >= 0.3 ? 'var(--seq-4)' : r >= 0.22 ? 'var(--seq-3)' : r >= 0.14 ? 'var(--seq-2)' : r > 0 ? 'var(--seq-1)' : 'var(--seq-0)';
  const seqInk = r => r >= 0.22 ? (document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches ? '#0d1533' : '#fff') : 'var(--ink)';

  view.innerHTML = `${sampleNotice()}
    <header class="vhead"><h1>Your week</h1><p>${label}. Every tap you log, nothing else.</p></header>
    <div class="seg" role="group" aria-label="Which week"><button type="button" data-week="0" aria-pressed="${weekOffset === 0}">Last 7 days</button><button type="button" data-week="1" aria-pressed="${weekOffset === 1}">7 days before</button></div>
    ${f.tries ? `
    <div class="tiles">
      <div class="tile"><b>${f.tries}</b><span>Tries</span><small>&nbsp;</small></div>
      <div class="tile"><b>${f.stopped}</b><span>Stopped</span><small>${pct(f.stopped, f.tries)}%</small></div>
      <div class="tile"><b>${f.owners}</b><span>Owners</span><small>${pct(f.owners, f.tries)}%</small></div>
      <div class="tile"><b>${f.booked}</b><span>Booked</span><small>${pct(f.booked, f.tries)}%</small></div>
    </div>
    <section class="best" aria-label="What's working">
      ${bestO ? `<div class="best-row"><span>Best opener</span><b>“${esc(bestO.o.line)}”</b><small>${bestO.booked} booked and ${bestO.owners} owners from ${bestO.tries} tries${bestO.tries < 8 ? '. Small sample, keep testing' : ''}</small></div>` : ''}
      ${bestCell ? `<div class="best-row"><span>Best time</span><b>${days[bestCell.di]} ${hourLabel(blocks[bestCell.bi][0])} to ${hourLabel(blocks[bestCell.bi][1])}</b><small>${bestCell.c.owners} owners and ${bestCell.c.booked} booked from ${bestCell.c.tries} tries</small></div>` : ''}
      ${bestS ? `<div class="best-row"><span>Best spot</span><b>${esc(bestS.spot)}</b><small>${pct(bestS.owners, bestS.tries)}% of tries were owners who stopped</small></div>` : ''}
    </section>
    <section class="section"><h2 class="section-title">Openers: how many tries turned into an owner</h2>
      <div class="bars">${[...byOpener].sort((a, b) => (b.owners / b.tries) - (a.owners / a.tries)).map(x => `
        <div class="bar-row"><div class="bar-label"><span>${x.i + 1}. ${esc(x.o.line)}</span><span>${pct(x.owners, x.tries)}%</span></div>
        <div class="bar-track" title="${x.tries} tries, ${x.owners} owners, ${x.booked} booked"><div class="bar-fill" style="width:${Math.max(2, pct(x.owners, x.tries) * 2)}%"></div></div>
        <div class="bar-label small"><span class="muted">${x.tries} tries, ${x.booked} booked</span><span></span></div></div>`).join('')}</div>
    </section>
    <section class="section"><h2 class="section-title">When owners stop</h2>
      <div class="heat" role="table" aria-label="Owners per try by day and time">
        <span></span>${blocks.map(b => `<span class="hd">${hourLabel(b[0])}</span>`).join('')}
        ${grid.map((row, di) => `<span class="rl">${days[di]}</span>${row.map((c, bi) => {
          const r = c.tries ? c.owners / c.tries : 0;
          const best = bestCell && bestCell.di === di && bestCell.bi === bi;
          return `<span class="cell${best ? ' best-cell' : ''}" style="background:${seq(r)};color:${seqInk(r)}" title="${days[di]} ${hourLabel(blocks[bi][0])}: ${c.tries} tries, ${c.owners} owners, ${c.booked} booked">${c.booked || ''}</span>`;
        }).join('')}`).join('')}
      </div>
      <div class="legend"><span>Fewer owners</span><i style="background:var(--seq-1)"></i><i style="background:var(--seq-2)"></i><i style="background:var(--seq-3)"></i><i style="background:var(--seq-4)"></i><span>More owners. Numbers are bookings.</span></div>
    </section>
    <section class="section"><h2 class="section-title">Spots in the store</h2>
      <div class="bars">${spots.map(s => `<div class="bar-row"><div class="bar-label"><span>${esc(s.spot)}</span><span>${pct(s.owners, s.tries)}% owners</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, pct(s.owners, s.tries) * 2)}%"></div></div>
        <div class="bar-label small"><span class="muted">${s.tries} tries, ${s.booked} booked</span><span></span></div></div>`).join('')}</div>
    </section>` : `<div class="empty"><h3>No taps yet</h3><p class="muted">After each chat on the floor, tap Walked by, Stopped, Owner or Booked on the Coach tab. By the weekend you'll see your best opener, time and spot here.</p><a class="btn small" href="#coach">Go to Coach</a></div>`}`;
}

/* ---------- More ---------- */
function qrSvg(text, { ec = 'M', color = '#141f48', quiet = 0 } = {}) {
  if (!window.qrcode) return '';
  const qr = window.qrcode(0, ec);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}" shape-rendering="crispEdges" role="img" aria-label="QR code"><path d="${path}" fill="${color}"/></svg>`;
}

function renderMore() {
  const d = load();
  const s = d.settings;
  const link = pageLink(s, { s: 'b' });
  const ready = s.first && validPhone(s.phone);
  view.innerHTML = `
    <header class="vhead"><h1>More</h1><p>Your details stay on this phone and go into your card and links.</p></header>
    <section class="card" aria-labelledby="you-h">
      <h2 id="you-h">You</h2>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" data-set="first" value="${esc(s.first)}" autocapitalize="words" placeholder="Your first name"></label>
        <label class="field"><span>Your mobile</span><input class="input" data-set="phone" type="tel" inputmode="tel" value="${esc(fmtPhone(s.phone))}" placeholder="(909) 555-0100"></label>
      </div>
      <label class="field"><span>Your Google Form's pre-filled link</span><input class="input" data-set="form" type="url" inputmode="url" value="${esc(s.form)}" placeholder="https://docs.google.com/forms/d/e/..."></label>
      <p class="small">${s.form ? (parseForm(s.form) ? '✓ Connected. Requests from your page go to your own Google Sheet.' : '<b>That link doesn\'t look right.</b> Type NAME, PHONE and DETAILS as the three answers, then copy the pre-filled link.') : 'Requests from your page go to your own free Google Form and Sheet.'} <a href="../setup/">How to set it up</a></p>
    </section>
    <section class="card" aria-labelledby="link-h">
      <h2 id="link-h">Your page</h2>
      <p>People scan this, see their roof, and pick a time on their own phone, later. It works in a TikTok or Instagram bio too.</p>
      ${ready ? '' : '<p class="small"><b>Add your first name and mobile above</b> so the page and card can say who you are.</p>'}
      <div style="display:flex;gap:.9rem;align-items:center;flex-wrap:wrap"><div class="qr-mini">${qrSvg(link)}</div><div class="linkbox" style="flex:1 1 12rem">${esc(link)}</div></div>
      <div class="btnrow"><button class="btn small" type="button" data-act="share-link">${ICONS.share} Share</button><button class="btn small ghost" type="button" data-act="copy-link">${ICONS.copy} Copy</button><a class="btn small ghost" href="${esc(link)}">Open it</a></div>
    </section>
    <section class="card" aria-labelledby="print-h">
      <h2 id="print-h">Print</h2>
      <div class="btnrow">
        <a class="btn small" href="../print/?item=card">${ICONS.print} No-time cards</a>
        <a class="btn small ghost" href="../print/?item=friend">Friend cards</a>
        <a class="btn small ghost" href="../print/?item=sign">Counter sign</a>
      </div>
      <p class="small">Anything you set out at the booth, like the counter sign, needs your manager's OK first.</p>
      <label class="field"><span>Door hangers for a street where someone you booked just went solar</span><input class="input" id="hanger-street" placeholder="Street name, like Orchard Ave"></label>
      <div class="btnrow"><button class="btn small ghost" type="button" data-act="hanger">${ICONS.print} Door hangers</button></div>
      <p class="small">Hang them on doors or handles. Never in mailboxes (federal law), and never name the neighbor.</p>
    </section>
    <section class="card" aria-labelledby="practice-h">
      <h2 id="practice-h">Practice with a tough shopper</h2>
      <p>Paste this into ChatGPT, then tap the voice button and talk. It plays a busy shopper, throws objections at you and coaches you after each round. Free on your own account.</p>
      <div class="prompt" id="prompt">${esc(PRACTICE_PROMPT(openers(), answers()))}</div>
      <div class="btnrow"><button class="btn small" type="button" data-act="copy-prompt">${ICONS.copy} Copy prompt</button><a class="btn small ghost" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a></div>
    </section>
    <section class="card" aria-labelledby="names-h">
      <h2 id="names-h">Names, once your manager OKs them</h2>
      <p>Leave these blank until then. Your answers and texts show a placeholder instead.</p>
      <div class="row2">
        <label class="field"><span>Company</span><input class="input" data-set="company" value="${esc(s.company)}" placeholder="[company]"></label>
        <label class="field"><span>Store</span><input class="input" data-set="store" value="${esc(s.store)}" placeholder="[store]"></label>
      </div>
      <label class="field"><span>Referral reward line (current terms, in your words)</span><input class="input" data-set="reward" value="${esc(s.reward)}" placeholder="Ask me about the current referral reward."></label>
    </section>
    <section class="card" aria-labelledby="spots-h">
      <h2 id="spots-h">Stores and spots</h2>
      <label class="field"><span>Your stores, separated by commas</span><input class="input" data-list="stores" value="${esc(s.stores.join(', '))}"></label>
      <label class="field"><span>Spots in the store</span><input class="input" data-list="spots" value="${esc(s.spots.join(', '))}"></label>
    </section>
    <section class="card" aria-labelledby="setup-h">
      <h2 id="setup-h">Set it up on your phone</h2>
      <p>Your free Google Form for requests, a ping when one comes in, this app on your home screen, and what to clear with your manager first.</p>
      <a class="btn small" href="../setup/">Open the setup steps</a>
    </section>
    <section class="card" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <p>${d.taps.length} taps, ${d.maybes.length} maybes and ${d.bookings.length} bookings, saved only in this phone's browser. Add the app to your home screen so it's kept.</p>
      <div class="btnrow">
        <button class="btn small ghost" type="button" data-act="export">Save a backup</button>
        <label class="btn small ghost" for="import-file">Restore a backup</label><input type="file" id="import-file" accept="application/json" hidden>
        ${d.samples ? '<button class="btn small ghost" type="button" data-act="clear-samples">Clear sample data</button>' : ''}
        <button class="btn small ghost" type="button" data-act="erase">Erase everything</button>
      </div>
      <div id="erase-confirm" hidden class="notice"><span>Erase every tap, maybe and booking on this phone? This can't be undone.</span><button class="btn small" type="button" data-act="erase-yes">Erase</button></div>
    </section>`;

  view.querySelectorAll('[data-set]').forEach(inp => inp.addEventListener('change', () => {
    update(x => { x.settings[inp.dataset.set] = inp.dataset.set === 'phone' ? digits(inp.value) : inp.value.trim(); });
    if (inp.dataset.set === 'phone' && inp.value && !validPhone(inp.value)) toast('That mobile number needs 10 digits'); else toast('Saved on this phone');
    renderMore();
  }));
  view.querySelectorAll('[data-list]').forEach(inp => inp.addEventListener('change', () => {
    const vals = inp.value.split(',').map(v => v.trim()).filter(Boolean);
    update(x => {
      x.settings[inp.dataset.list] = vals.length ? vals : x.settings[inp.dataset.list];
      if (inp.dataset.list === 'stores' && !x.settings.stores.includes(x.ui.where)) x.ui.where = x.settings.stores[0];
      if (inp.dataset.list === 'spots' && !x.settings.spots.includes(x.ui.spot)) x.ui.spot = x.settings.spots[0];
    });
    toast('Saved on this phone');
  }));
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { importJSON(await file.text()); toast('Backup restored'); route(); } catch (err) { toast(err.message); }
  });
}

/* ---------- one click handler for the whole view ---------- */
view.addEventListener('click', async e => {
  const r = e.target.closest('[data-r]');
  if (r) return logTap(r.dataset.r, r);
  const ans = e.target.closest('[data-answer]');
  if (ans) return openAnswer(ans.dataset.answer);
  const ptab = e.target.closest('[data-ptab]');
  if (ptab) { peopleTab = ptab.dataset.ptab; return renderPeople(); }
  const wk = e.target.closest('[data-week]');
  if (wk) { weekOffset = Number(wk.dataset.week); return renderStats(); }
  const sm = e.target.closest('[data-stopm]');
  if (sm) return stopMaybe(load().maybes.find(m => m.id === sm.dataset.stopm));
  const dm = e.target.closest('[data-delm]');
  if (dm) { update(d => { d.maybes = d.maybes.filter(m => m.id !== dm.dataset.delm); }); toast('Deleted from this phone'); return renderPeople(); }
  const bk = e.target.closest('[data-book]');
  if (bk) return bookingCard(load().bookings.find(b => b.id === bk.dataset.book));

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const d = load();
  switch (act.dataset.act) {
    case 'next': case 'prev': {
      const n = OPENERS.length;
      update(x => { x.ui.opener = (x.ui.opener + (act.dataset.act === 'next' ? 1 : n - 1)) % n; });
      return renderCoach();
    }
    case 'where': return pickFrom('Which store?', d.settings.stores, d.ui.where, v => { update(x => { x.ui.where = v; }); renderCoach(); });
    case 'spot': return pickFrom('Where are you standing?', d.settings.spots, d.ui.spot, v => { update(x => { x.ui.spot = v; }); renderCoach(); });
    case 'edit-opener': return editOpener();
    case 'undo': return undoTap();
    case 'maybe': return addMaybe();
    case 'code': return showCode();
    case 'add-booking': return addBooking();
    case 'clear-samples': clearSamples(); toast('Sample data cleared'); return route();
    case 'share-link': {
      const res = await shareOrCopy({ title: 'See solar on your roof', text: 'See your roof from above and pick a time that works:', url: pageLink(d.settings, { s: 'b' }) });
      if (res === 'copied') toast('Link copied');
      return;
    }
    case 'copy-link': (await copyText(pageLink(d.settings, { s: 'b' }))) ? toast('Link copied') : toast('Copy blocked. Press and hold the link to copy.'); return;
    case 'copy-prompt': (await copyText($('#prompt').textContent)) ? toast('Prompt copied. Paste it into ChatGPT.') : toast('Copy blocked. Press and hold the text to copy.'); return;
    case 'hanger': {
      const st = ($('#hanger-street').value || '').trim();
      location.href = `../print/?item=hanger${st ? `&st=${encodeURIComponent(st)}` : ''}`;
      return;
    }
    case 'export': download(`pocket-coach-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(), 'application/json'); toast('Backup saved to your downloads'); return;
    case 'erase': $('#erase-confirm').hidden = false; return;
    case 'erase-yes': clearAll(); toast('Everything erased from this phone'); return route();
  }
});

/* ---------- start ---------- */
function boot() {
  const d = load();
  const fresh = !d.taps.length && !d.maybes.length && !d.bookings.length && !d.firstRun;
  if (fresh) {
    const s = sampleData();
    update(x => { x.taps = s.taps; x.maybes = s.maybes; x.bookings = s.bookings; x.samples = true; x.firstRun = Date.now(); });
  }
  keepData();
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
boot();
