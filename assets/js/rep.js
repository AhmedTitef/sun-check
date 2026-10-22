// Pocket Coach: the rep's phone comes out only at the end of a chat, so the floor
// screen is three big buttons and nothing to read. Everything stays on this phone.

import { load, update, clearSamples, clearAll, exportJSON, importJSON, keepData } from './store.js';
import { OPENERS, ANSWERS, TAGS, PRACTICE_PROMPT } from './content.js';
import { maybeText, maybeDue, maybePlan, confirmNowText, confirmBeforeText, voiceMemoScript, neighborText, prefsText } from './texts.js';
import { sampleData } from './sample.js';
import { $, $$, esc, uid, digits, fmtPhone, validPhone, fmtTime, fmtDay, fmtWhen, smsHref, copyText, shareOrCopy, download, toast, sheet, pageLink, parseForm, ICONS, startOfDay, daysBetween } from './util.js';

const view = $('#view');
const TOP5 = ['no', 'cost', 'spouse', 'rent', 'credit'];
let pending = null; // a text the rep just opened in Messages

/* ---------- content, with the rep's own edits ---------- */
const openers = () => { const e = load().edits.openers; return OPENERS.map(o => ({ ...o, ...(e[o.id] || {}) })); };
const answers = () => { const e = load().edits.answers; return ANSWERS.map(a => ({ ...a, ...(e[a.id] || {}) })); };

// One opener a day, picked for her, so the week view can compare them.
function openerFor(date = new Date()) {
  const list = openers();
  const day = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(2026, 0, 1)) / 86400000);
  return list[((day % list.length) + list.length) % list.length];
}

function fillNames(text) {
  const s = load().settings;
  return esc(text)
    .replace(/\[company\]/g, s.company ? esc(s.company) : '<span class="placeholder">[company]</span>')
    .replace(/\[store\]/g, s.store ? esc(s.store) : '<span class="placeholder">[store]</span>');
}

function realAction() {
  if (load().samples) { clearSamples(); showRibbon(); toast('Sample data cleared. From here on it is all yours.'); }
}
function showRibbon() { const on = load().samples; $('#ribbon').hidden = !on; document.body.classList.toggle('clean', !on); }

const afterHours = (d = new Date()) => d.getHours() >= 21 || d.getHours() < 8;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const tally = taps => ({ chats: taps.length, booked: taps.filter(t => t.r === 'book').length, maybes: taps.filter(t => t.r === 'maybe').length });

/* ---------- routing ---------- */
const routes = { floor: renderFloor, tonight: renderTonight, practice: renderPractice, week: renderWeek, more: renderMore, people: renderPeople };
const TAB_OF = { people: 'more' };
function route() {
  const name = (location.hash || '#floor').slice(1).split('/')[0];
  const key = routes[name] ? name : 'floor';
  const tab = TAB_OF[key] || key;
  $$('.tabs a').forEach(a => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.body.dataset.view = key;
  routes[key]();
  updateBadge();
  showRibbon();
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

/* ---------- Floor: three big buttons ---------- */
const QR_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm3 3h2v2h-2zm2-3h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3z"/></svg>';

function renderFloor() {
  const o = openerFor();
  const s = startOfDay().getTime();
  const f = tally(load().taps.filter(t => t.t >= s));
  view.innerHTML = `
    ${sampleNotice()}
    <p class="opener-mini"><span>Today's opener</span>“${esc(o.line)}”</p>
    <div class="floor">
      <button class="big code" type="button" data-act="code">${QR_ICON}<span>My code</span></button>
      <button class="big maybe" type="button" data-act="maybe">${ICONS.plus}<span>Maybe</span></button>
      <button class="big booked" type="button" data-act="booked">${ICONS.check}<span>Booked</span></button>
      <button class="nobook" type="button" data-act="nobook">Didn't book</button>
    </div>
    <p class="today">Today: <b>${f.chats}</b> chats, <b>${f.booked}</b> booked, <b>${f.maybes}</b> maybes${f.chats ? ` <button class="linkbtn small" type="button" data-act="undo">Undo last</button>` : ''}</p>`;
}

function logChat(r) {
  realAction();
  const d = load();
  const tap = { t: Date.now(), o: openerFor().id, r, spot: d.ui.spot, where: d.ui.where };
  update(x => x.taps.push(tap));
  if (navigator.vibrate) navigator.vibrate(r === 'book' ? [12, 40, 12] : 12);
  return tap;
}

function booked() {
  logChat('book');
  renderFloor();
  stamp();
  toast('Booked. Nice!', { label: 'Add for reminders', run: () => addBooking({ src: 'Booth' }) });
}

function noBook() {
  const tap = logChat('no');
  renderFloor();
  toast('Logged. On to the next one.', { label: 'Undo', run: () => undoTap(tap.t) });
}

function stamp() {
  const el = document.createElement('div');
  el.className = 'stamp';
  el.textContent = 'Booked!';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function undoTap(t) {
  update(d => {
    const i = t ? d.taps.findIndex(x => x.t === t) : d.taps.length - 1;
    if (i >= 0) d.taps.splice(i, 1);
  });
  route();
  toast('Removed the last chat');
}

/* ---------- My code: full screen, made on the phone, keeps the screen awake ---------- */
let wakeLock = null;
async function holdScreen() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
}
function onVisible() { if (document.visibilityState === 'visible' && $('.codescreen')) holdScreen(); }

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

function showCode() {
  const st = load().settings;
  const link = pageLink(st, { s: 'q' });
  const el = document.createElement('div');
  el.className = 'codescreen';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Your code');
  el.innerHTML = `<div class="big-qr">${qrSvg(link, { ec: 'L', color: '#000', quiet: 3 })}</div>
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

/* ---------- Maybe: first name and number, the rest is optional ---------- */
function consentLine(settings) {
  const who = settings.first ? settings.first.trim() : 'the rep';
  const co = settings.company ? settings.company.trim() : '[company]';
  return `Yes, ${who} with ${co} may text me about solar at this number, even if it's on a Do Not Call list. Up to 6 texts over 2 months, sent by hand. Reply STOP anytime. Agreeing isn't required to buy anything.`;
}

function addMaybe() {
  const st = load().settings;
  const line = consentLine(st);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const s = sheet({
    title: 'Add a maybe',
    body: `<form class="form" novalidate>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" id="m-first" autocomplete="off" autocapitalize="words" enterkeyhint="next" autofocus></label>
        <label class="field"><span>Mobile</span><input class="input" id="m-phone" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div class="consent">
        <p class="handoff">Hand them your phone for this box, so the OK is theirs.</p>
        <label class="check"><input type="checkbox" id="m-ok"><span>${fillNames(line)}</span></label>
      </div>
      <details class="more-opt"><summary>Add a reason, check-back date or address (optional)</summary>
        <div class="form" style="margin-top:.8rem">
          <div class="field"><span>Why not today?</span><div class="chips" id="m-tags">${TAGS.map(t => `<button class="chip" type="button" data-tag="${t.id}" aria-pressed="false">${t.label}</button>`).join('')}</div></div>
          <div class="field"><span>Check back</span><div class="chips" id="m-cb">
            <button class="chip" type="button" data-cb="month" aria-pressed="false">In a month</button>
            <button class="chip" type="button" data-cb="holidays" aria-pressed="false">After the holidays</button>
            <button class="chip" type="button" data-cb="three" aria-pressed="false">In 3 months</button>
            <button class="chip" type="button" data-cb="pick" aria-pressed="false">Pick a date</button></div>
            <input class="input" id="m-cbdate" type="date" hidden></div>
          <label class="field"><span>Street and ZIP</span><input class="input" id="m-addr" autocomplete="off" placeholder="1234 Orchard Ave, 92335"><small class="small muted">Their texts then open with their own roof ready.</small></label>
        </div>
      </details>
      <p class="small muted" id="m-err" role="alert"></p>
      <button class="btn wide" type="submit">Save</button>
    </form>`,
  });
  let tag = null;
  let checkBack = null;
  s.body.querySelector('#m-tags').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('#m-tags .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    tag = on ? b.dataset.tag : null;
    if (on) b.setAttribute('aria-pressed', 'true');
  });
  s.body.querySelector('#m-cb').addEventListener('click', e => {
    const b = e.target.closest('[data-cb]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('#m-cb .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    const dateInput = $('#m-cbdate');
    dateInput.hidden = true; checkBack = null;
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
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('#m-first').value.trim();
    const phone = $('#m-phone').value;
    const err = $('#m-err');
    if (!first) { err.textContent = 'Add their first name.'; return; }
    if (!validPhone(phone)) { err.textContent = 'That mobile number needs 10 digits.'; return; }
    if (!$('#m-ok').checked) { err.textContent = 'They need to tick the box before you can text them.'; return; }
    logChat('maybe');
    const now = Date.now();
    update(d => d.maybes.unshift({ id: uid(), first, phone: digits(phone), address: $('#m-addr').value.trim(), tags: tag ? [tag] : [], checkBack: checkBack && checkBack.date, checkNote: checkBack && checkBack.note, start: now, consentAt: now, consentText: line, sent: {}, stopped: false }));
    s.close();
    toast(`${first} saved. Their first text is ready tonight.`);
    route();
  });
}

/* ---------- Bookings (for reminders from her phone) ---------- */
function addBooking(prefill = {}) {
  const tomorrow = new Date(Date.now() + 86400000);
  const s = sheet({
    title: 'Add for reminders',
    body: `<form class="form" novalidate>
      <p class="small muted">So the day-before confirm is ready on time. The tablet stays the real record.</p>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" id="b-first" autocapitalize="words" autofocus></label>
        <label class="field"><span>Mobile</span><input class="input" id="b-phone" type="tel" inputmode="tel"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Day</span><input class="input" id="b-date" type="date" value="${tomorrow.toISOString().slice(0, 10)}"></label>
        <label class="field"><span>Time</span><input class="input" id="b-time" type="time" value="18:00" step="900"></label>
      </div>
      <details class="more-opt"><summary>How they'll meet and who'll be there (optional)</summary>
        <div class="form" style="margin-top:.8rem">
          <div class="seg" id="b-type"><button type="button" data-v="visit" aria-pressed="true">Consultant visits</button><button type="button" data-v="call" aria-pressed="false">Phone or video</button></div>
          <div class="seg" id="b-both"><button type="button" data-v="both" aria-pressed="true">Both owners</button><button type="button" data-v="solo" aria-pressed="false">Sole owner</button><button type="button" data-v="one" aria-pressed="false">One of two</button></div>
        </div>
      </details>
      <p class="small muted" id="b-err" role="alert"></p>
      <button class="btn wide" type="submit">Save</button>
    </form>`,
  });
  ['#b-type', '#b-both'].forEach(sel => s.body.querySelector(sel).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$(`${sel} button`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const first = $('#b-first').value.trim();
    const phone = $('#b-phone').value;
    const err = $('#b-err');
    if (!first) { err.textContent = 'Add their first name.'; return; }
    if (!validPhone(phone)) { err.textContent = 'That mobile number needs 10 digits.'; return; }
    const when = new Date(`${$('#b-date').value}T${$('#b-time').value || '18:00'}`);
    if (isNaN(when)) { err.textContent = 'Pick a day and time.'; return; }
    const pick = sel => $(`${sel} [aria-pressed="true"]`).dataset.v;
    update(d => d.bookings.unshift({ id: uid(), first, phone: digits(phone), when: when.toISOString(), prefs: [], type: pick('#b-type'), both: pick('#b-both'), src: prefill.src || 'Booth', created: Date.now(), sent: { now: Date.now() } }));
    s.close();
    toast(`${first} saved. The day-before confirm will be ready.`);
    route();
  });
}

function setTime(b) {
  const d0 = b.when ? new Date(b.when) : new Date(Date.now() + 86400000);
  const s = sheet({
    title: `${b.first}'s time`,
    body: `<form class="form">
      <p class="small muted">Set the time you booked in the tablet. The day-before confirm lines up from it.</p>
      <div class="row2">
        <label class="field"><span>Day</span><input class="input" id="t-date" type="date" value="${d0.toISOString().slice(0, 10)}"></label>
        <label class="field"><span>Time</span><input class="input" id="t-time" type="time" value="${b.when ? d0.toTimeString().slice(0, 5) : '18:00'}" step="900"></label>
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

// In the order the company's own web form asks (name, phone, email, address,
// ZIP, own or rent), then the extras, so it copies into the tablet in one pass.
function bookingCard(b) {
  const row = (k, v) => (v ? `<div class="fieldcopy"><span>${k}</span><span>${esc(v)}</span><button type="button" data-copy="${esc(v)}" aria-label="Copy ${k}">${ICONS.copy}</button></div>` : '');
  const facing = b.facing ? `${b.facing}${b.facingHow ? ` (${b.facingHow})` : ''}` : '';
  const s = sheet({
    title: `${b.first} ${b.last || ''}`.trim(),
    body: `<p class="small muted" style="margin-bottom:.6rem">Everything you need to enter it in the company tablet, in order.</p>
      ${row('First name', b.first)}${row('Last name', b.last)}${row('Mobile', fmtPhone(b.phone))}${row('Email', b.email)}
      ${row('Street', b.street || b.address)}${row('ZIP', b.zip)}${row('Owns the home', b.own === false ? 'No' : b.own ? 'Yes' : '')}
      ${row('Front faces', facing)}${row('Panels', b.placement)}${row('Monthly bill', b.bill ? `$${b.bill}` : '')}${row('Utility', b.utility)}
      ${b.when ? row('When', `${fmtDay(b.when)}, ${fmtTime(b.when)}`) : row('Prefers', prefsText(b.prefs) || 'Any time')}
      ${row('Meeting', b.type === 'call' ? 'Phone or video' : b.type === 'visit' ? 'Consultant visits' : '')}${row('Owners there', b.both === 'both' ? 'Both owners' : b.both === 'one' ? 'One of two owners' : b.both === 'solo' ? 'Sole owner' : '')}
      ${row('Estimate shown', b.estimate)}${row('Came from', b.src)}${row('Referred by', b.ref)}
      <div class="sheet-actions"><button class="btn small" type="button" data-act="time">${b.when ? 'Change time' : 'Set the time'}</button><button class="btn ghost small" type="button" data-act="voice">Voice memo script</button><button class="btn ghost small" type="button" data-act="del">Delete</button></div>`,
  });
  s.body.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]');
    if (c) { (await copyText(c.dataset.copy)) ? toast('Copied') : toast('Copy blocked. Press and hold to copy.'); }
    if (e.target.closest('[data-act="time"]')) { s.close(); setTime(b); }
    if (e.target.closest('[data-act="voice"]')) { s.close(); voiceSheet(b); }
    if (e.target.closest('[data-act="del"]')) { update(d => { d.bookings = d.bookings.filter(x => x.id !== b.id); }); s.close(); toast('Deleted from this phone'); route(); }
  });
}

function voiceSheet(b) {
  sheet({
    title: 'Voice memo script',
    body: `<p class="small muted" style="margin-bottom:.7rem">Read it into a voice message in Messages. About 20 seconds.</p><div class="script">${esc(voiceMemoScript(b, load().settings))}</div>
      <div class="sheet-actions"><a class="btn small" href="${esc(smsHref(b.phone, ''))}">${ICONS.mic} Open Messages</a></div>`,
  });
}

/* ---------- Tonight: tap, send, next ---------- */
function tasks(now = new Date()) {
  const d = load();
  const list = [];
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  for (const b of d.bookings) {
    const sent = b.sent || {};
    if (!sent.now && (!b.when || new Date(b.when) > now)) list.push({ kind: 'now', b, pri: 0, key: `${b.id}:now` });
    if (!b.when) continue;
    const when = new Date(b.when);
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
  if (t.kind === 'before') return confirmBeforeText(t.b, st);
  if (t.kind === 'neighbor') return neighborText(t.b, st);
  return maybeText(t.step, t.m, st);
}

function taskLabel(t) {
  if (t.kind === 'now') return t.b.when ? 'New booking: text them now' : 'New request: offer two times within 5 minutes';
  if (t.kind === 'before') return `Confirm ${fmtWhen(t.b.when)}`;
  if (t.kind === 'neighbor') return 'Thank you and a neighbor link';
  if (t.step === 'cb') return 'Their check-back day';
  return `Maybe follow-up ${(t.index || 0) + 1} of ${t.total}`;
}

function renderTonight() {
  const st = load().settings;
  const list = tasks();
  const late = afterHours();
  const head = `<header class="vhead"><h1>Tonight</h1><p>${list.length ? `${list.length} to send. Tap Send, it opens Messages, then the next one comes up.` : 'Nothing to send right now.'}</p></header>`;
  const notes = [
    late ? `<div class="notice"><span>It's after 9 PM. Texts wait until 8 AM; the law limits texting to 8 AM to 9 PM.</span></div>` : '',
    !st.first ? `<div class="notice"><span>Add your first name in More so texts say who they're from.</span><a class="btn small ghost" href="#more">Add it</a></div>` : '',
  ].join('');
  if (!list.length) {
    view.innerHTML = `${sampleNotice()}${head}${notes}
      <div class="empty">
        <svg class="moon" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="var(--label-bg)"/><path d="M41 44a16 16 0 1 1-8-30 13 13 0 0 0 8 30z" fill="#f4cc2a"/><circle cx="17" cy="19" r="1.6" fill="#fff"/><circle cx="48" cy="24" r="1.2" fill="#fff"/><circle cx="45" cy="13" r="1" fill="#fff"/></svg>
        <h3>All caught up</h3>
        <p class="muted">New requests, day-before confirms, maybe follow-ups and neighbor links land here when they're due.</p>
      </div>
      <p><a href="#people">Everyone on your lists</a></p>`;
    return;
  }
  view.innerHTML = `${sampleNotice()}${head}${notes}
    <ol class="queue">${list.map((t, i) => {
      const p = t.b || t.m;
      const text = taskText(t, st);
      return `<li class="task${i === 0 ? ' first' : ''}" data-key="${t.key}">
        <p class="task-label">${esc(taskLabel(t))}</p>
        <h3>${esc(p.first)}${p.last ? ` ${esc(p.last[0])}.` : ''}</h3>
        <p class="msg" data-msg>${esc(text)}</p>
        <div class="task-actions">
          ${late ? `<span class="btn ghost" aria-disabled="true">Send after 8 AM</span>` : `<a class="btn" data-send href="${esc(smsHref(p.phone, text))}">${ICONS.sms} Send</a>`}
          <button class="btn ghost" type="button" data-skip>Skip</button>
        </div>
        <button class="linkbtn small" type="button" data-edit>Edit the words</button>
      </li>`;
    }).join('')}</ol>
    <p><a href="#people">Everyone on your lists</a></p>`;
  view.querySelectorAll('.task').forEach(card => card.addEventListener('click', e => {
    const t = list.find(x => x.key === card.dataset.key);
    if (!t) return;
    if (e.target.closest('[data-send]')) { pending = t; return; }
    if (e.target.closest('[data-skip]')) return skipTask(t);
    if (e.target.closest('[data-edit]')) {
      const msg = card.querySelector('[data-msg]');
      const ta = document.createElement('textarea');
      ta.className = 'textarea'; ta.value = msg.textContent; ta.setAttribute('aria-label', `Message to ${(t.b || t.m).first}`);
      msg.replaceWith(ta);
      ta.focus();
      ta.addEventListener('input', () => { const a = card.querySelector('[data-send]'); if (a) a.href = smsHref((t.b || t.m).phone, ta.value); });
      e.target.closest('[data-edit]').remove();
    }
  }));
}

// When she comes back from Messages, count the text as sent and show the next one.
function settlePending() {
  if (!pending || document.visibilityState !== 'visible') return;
  const t = pending; pending = null;
  markSent(t);
}
document.addEventListener('visibilitychange', () => setTimeout(settlePending, 250));
window.addEventListener('focus', () => setTimeout(settlePending, 250));

function markSent(t) {
  const at = Date.now();
  update(d => {
    if (t.b) { const b = d.bookings.find(x => x.id === t.b.id); if (b) { b.sent = b.sent || {}; b.sent[t.kind] = at; } }
    if (t.m) { const m = d.maybes.find(x => x.id === t.m.id); if (m) { m.sent = m.sent || {}; m.sent[t.step] = at; } }
  });
  if ((location.hash || '').startsWith('#tonight')) renderTonight();
  updateBadge();
  toast(`Sent to ${(t.b || t.m).first}`, { label: 'Undo', run: () => {
    update(d => {
      if (t.b) { const b = d.bookings.find(x => x.id === t.b.id); if (b) delete b.sent[t.kind]; }
      if (t.m) { const m = d.maybes.find(x => x.id === t.m.id); if (m) delete m.sent[t.step]; }
    });
    route();
  } });
}

function skipTask(t) {
  if (t.m) update(d => { const m = d.maybes.find(x => x.id === t.m.id); if (m) m.start = (m.start || Date.now()) + 86400000; });
  else update(d => { const b = d.bookings.find(x => x.id === t.b.id); if (b) { b.sent = b.sent || {}; b.sent[t.kind] = -1; } });
  renderTonight(); updateBadge();
  toast(t.m ? 'Moved to tomorrow' : 'Skipped');
}

/* ---------- Practice: before the shift or on a break ---------- */
function renderPractice() {
  const all = answers();
  const top = TOP5.map(id => all.find(a => a.id === id)).filter(Boolean);
  const rest = all.filter(a => !TOP5.includes(a.id));
  view.innerHTML = `
    <header class="vhead"><h1>Practice</h1><p>For before your shift or a break. Read what they say, answer out loud, then flip the card.</p></header>
    <section class="rules" aria-labelledby="rules-h"><h2 id="rules-h">Floor rules</h2>
      <ul><li>Help first, then say who you're with: “I'm with ${fillNames('[company]')}. I don't work for ${fillNames('[store]')}.”</li>
      <li>Never at the registers or in a checkout line.</li>
      <li>Take no for an answer. No following, no blocking an exit.</li>
      <li>Don't open by asking how much their bill is.</li></ul></section>
    <section class="section" aria-labelledby="top-h"><h2 class="section-title" id="top-h">The five you'll hear most</h2>
      <div class="flashes">${top.map((a, i) => `
        <button class="flash" type="button" data-flip="${a.id}" aria-pressed="false">
          <span class="flash-front"><small>${i + 1} of 5. They say</small><b>“${esc(a.label)}”</b><em>Tap to see a good answer</em></span>
          <span class="flash-back"><small>${i + 1} of 5: “${esc(a.label)}”. You say</small><span class="flash-say">${fillNames(a.say)}</span>${a.next ? `<em>${fillNames(a.next)}</em>` : ''}</span>
        </button>`).join('')}</div>
    </section>
    <details class="section acc"><summary class="section-title">More answers (${rest.length})</summary>
      <div class="list">${rest.map(a => `<div class="ans"><p class="ans-q">“${esc(a.label)}”</p><p class="ans-a">${fillNames(a.say)}</p><button class="linkbtn small" type="button" data-edit-answer="${a.id}">Edit</button></div>`).join('')}</div>
    </details>
    <section class="card" aria-labelledby="gpt-h">
      <h2 id="gpt-h">Practice out loud with ChatGPT</h2>
      <p>Copy this, paste it into ChatGPT, then tap the voice button and talk. It plays a busy shopper, throws these objections at you and coaches you after each round. Free on your own account.</p>
      <div class="prompt" id="prompt">${esc(PRACTICE_PROMPT(openers(), all))}</div>
      <div class="btnrow"><button class="btn small" type="button" data-act="copy-prompt">${ICONS.copy} Copy prompt</button><a class="btn small ghost" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a></div>
    </section>
    <details class="section acc"><summary class="section-title">Openers (one a day, picked for you)</summary>
      <div class="list">${openers().map(o => `<div class="ans"><p class="ans-q">“${esc(o.line)}”</p><p class="ans-a muted">${esc(o.why)}</p><button class="linkbtn small" type="button" data-edit-opener="${o.id}">Edit</button></div>`).join('')}</div>
    </details>
    <p class="small muted">Edit any answer to match your training. Changes stay on this phone. The top five have Edit under More answers once you've practiced them.</p>`;
}

function editAnswer(id) {
  const a = answers().find(x => x.id === id);
  const base = ANSWERS.find(x => x.id === id);
  const s = sheet({
    title: 'Edit answer',
    body: `<form class="form">
      <label class="field"><span>What they say</span><input class="input" id="ea-label" value="${esc(a.label)}"></label>
      <label class="field"><span>What you say</span><textarea class="textarea" id="ea-say">${esc(a.say)}</textarea></label>
      <label class="field"><span>A note for you</span><textarea class="textarea" id="ea-next" style="min-height:5rem">${esc(a.next || '')}</textarea></label>
      <p class="small muted">One or two lines you can say out loud. No savings promises; the consultant shows the numbers.</p>
      <div class="btnrow"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="reset">Reset to default</button></div>
    </form>`,
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    update(d => { d.edits.answers[id] = { label: $('#ea-label').value.trim() || base.label, say: $('#ea-say').value.trim() || base.say, next: $('#ea-next').value.trim() }; });
    s.close(); toast('Saved on this phone'); route();
  });
  s.body.querySelector('[data-act="reset"]').addEventListener('click', () => { update(d => { delete d.edits.answers[id]; }); s.close(); toast('Back to the default'); route(); });
}

function editOpener(id) {
  const o = openers().find(x => x.id === id);
  const base = OPENERS.find(x => x.id === id);
  const s = sheet({
    title: 'Edit opener',
    body: `<form class="form">
      <label class="field"><span>The line</span><textarea class="textarea" id="eo-line" style="min-height:5rem">${esc(o.line)}</textarea></label>
      <label class="field"><span>Why it works</span><textarea class="textarea" id="eo-why" style="min-height:5rem">${esc(o.why)}</textarea></label>
      <div class="btnrow"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="reset">Reset to default</button></div>
    </form>`,
  });
  s.body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    update(x => { x.edits.openers[id] = { line: $('#eo-line').value.trim() || base.line, why: $('#eo-why').value.trim() }; });
    s.close(); toast('Saved on this phone'); route();
  });
  s.body.querySelector('[data-act="reset"]').addEventListener('click', () => { update(x => { delete x.edits.openers[id]; }); s.close(); toast('Back to the default'); route(); });
}

/* ---------- Week ---------- */
let weekOffset = 0;
function pickFrom(title, options, current, onPick) {
  const s = sheet({ title, body: `<div class="chips">${options.map(v => `<button class="chip" type="button" data-v="${esc(v)}" aria-pressed="${v === current}">${esc(v)}</button>`).join('')}</div><p class="small muted" style="margin-top:.9rem">Change the lists in More.</p>` });
  s.body.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; onPick(b.dataset.v); s.close(); });
}

function renderWeek() {
  const d = load();
  const end = Date.now() - weekOffset * 7 * 86400000;
  const start = end - 7 * 86400000;
  const taps = d.taps.filter(t => t.t >= start && t.t < end);
  const f = tally(taps);
  const ops = openers();
  const rate = x => (x.chats ? x.booked / x.chats : 0);
  const byOpener = ops.map((o, i) => ({ o, i, ...tally(taps.filter(t => t.o === o.id)) })).filter(x => x.chats);
  const enough = byOpener.filter(x => x.chats >= 6);
  const bestO = [...(enough.length ? enough : byOpener)].sort((a, b) => rate(b) - rate(a) || b.booked - a.booked)[0];
  const blocks = [[9, 11], [11, 13], [13, 15], [15, 17], [17, 19], [19, 21]];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const grid = days.map((_, di) => blocks.map(([h0, h1]) => tally(taps.filter(t => { const x = new Date(t.t); return (x.getDay() + 6) % 7 === di && x.getHours() >= h0 && x.getHours() < h1; }))));
  let bestCell = null;
  grid.forEach((row, di) => row.forEach((c, bi) => { if (c.chats >= 3 && (!bestCell || rate(c) > rate(bestCell.c) || (rate(c) === rate(bestCell.c) && c.booked > bestCell.c.booked))) bestCell = { di, bi, c }; }));
  const spots = [...new Set(taps.map(t => t.spot))].map(spot => ({ spot, ...tally(taps.filter(t => t.spot === spot)) })).sort((a, b) => rate(b) - rate(a));
  const bestS = spots.find(s => s.chats >= 6) || spots[0];
  const hl = h => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  const seq = r => (r >= 0.3 ? 'var(--seq-4)' : r >= 0.2 ? 'var(--seq-3)' : r >= 0.1 ? 'var(--seq-2)' : r > 0 ? 'var(--seq-1)' : 'var(--seq-0)');
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const ink = r => (r >= 0.2 ? (dark ? '#0d1533' : '#fff') : 'var(--ink)');
  view.innerHTML = `${sampleNotice()}
    <header class="vhead"><h1>Your week</h1><p>From your Booked and Didn't book taps. Nothing else is tracked.</p></header>
    <div class="workbar"><span>Working at</span>
      <button class="chip on" type="button" data-act="where">${esc(d.ui.where)}</button>
      <button class="chip" type="button" data-act="spot">${esc(d.ui.spot)}</button></div>
    <div class="seg" role="group" aria-label="Which week"><button type="button" data-week="0" aria-pressed="${weekOffset === 0}">Last 7 days</button><button type="button" data-week="1" aria-pressed="${weekOffset === 1}">7 days before</button></div>
    ${f.chats ? `
    <div class="tiles">
      <div class="tile"><b>${f.chats}</b><span>Chats</span></div>
      <div class="tile"><b>${f.booked}</b><span>Booked</span></div>
      <div class="tile"><b>${f.maybes}</b><span>Maybes</span></div>
      <div class="tile"><b>${pct(f.booked, f.chats)}%</b><span>Booked rate</span></div>
    </div>
    ${f.chats < 12 ? `<div class="notice"><span>Keep tapping. After about a dozen chats you'll see which opener, time and spot work best.</span></div>` : `<section class="best" aria-label="What's working">
      ${bestO ? `<div class="best-row"><span>Best opener</span><b>“${esc(bestO.o.line)}”</b><small>${bestO.booked} booked from ${bestO.chats} chats${bestO.chats < 6 ? '. Small sample, keep going' : ''}</small></div>` : ''}
      ${bestCell ? `<div class="best-row"><span>Best time</span><b>${days[bestCell.di]} ${hl(blocks[bestCell.bi][0])} to ${hl(blocks[bestCell.bi][1])}</b><small>${bestCell.c.booked} booked from ${bestCell.c.chats} chats</small></div>` : ''}
      ${bestS ? `<div class="best-row"><span>Best spot</span><b>${esc(bestS.spot)}</b><small>${pct(bestS.booked, bestS.chats)}% of chats there booked</small></div>` : ''}
    </section>`}
    <section class="section"><h2 class="section-title">Openers, one a day: chats that booked</h2>
      <div class="bars">${[...byOpener].sort((a, b) => rate(b) - rate(a)).map(x => `
        <div class="bar-row"><div class="bar-label"><span>${esc(x.o.line)}</span><span>${pct(x.booked, x.chats)}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.min(100, pct(x.booked, x.chats) * 2.5))}%"></div></div>
        <div class="bar-label small"><span class="muted">${x.chats} chats, ${x.booked} booked</span><span></span></div></div>`).join('')}</div>
    </section>
    <section class="section"><h2 class="section-title">When chats book</h2>
      <div class="heat" role="table" aria-label="Chats that booked, by day and time">
        <span></span>${blocks.map(b => `<span class="hd">${hl(b[0])}</span>`).join('')}
        ${grid.map((row, di) => `<span class="rl">${days[di]}</span>${row.map((c, bi) => {
          const r = rate(c);
          return `<span class="cell${bestCell && bestCell.di === di && bestCell.bi === bi ? ' best-cell' : ''}" style="background:${seq(r)};color:${ink(r)}" title="${days[di]} ${hl(blocks[bi][0])}: ${c.chats} chats, ${c.booked} booked">${c.booked || ''}</span>`;
        }).join('')}`).join('')}
      </div>
      <div class="legend"><span>Fewer</span><i style="background:var(--seq-1)"></i><i style="background:var(--seq-2)"></i><i style="background:var(--seq-3)"></i><i style="background:var(--seq-4)"></i><span>More of the chats booked. Numbers are bookings.</span></div>
    </section>
    <section class="section"><h2 class="section-title">Spots in the store</h2>
      <div class="bars">${spots.map(s => `<div class="bar-row"><div class="bar-label"><span>${esc(s.spot)}</span><span>${pct(s.booked, s.chats)}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.min(100, pct(s.booked, s.chats) * 2.5))}%"></div></div>
        <div class="bar-label small"><span class="muted">${s.chats} chats, ${s.booked} booked</span><span></span></div></div>`).join('')}</div>
    </section>` : `<div class="empty"><h3>Nothing yet this week</h3><p class="muted">After each chat, tap Booked or Didn't book on the Floor screen. By the weekend you'll see which opener, time and spot work best.</p></div>`}`;
}

/* ---------- People (from Tonight and More) ---------- */
let peopleTab = 'maybe';
function renderPeople() {
  const d = load();
  const bookings = [...d.bookings].sort((a, b) => (a.when ? new Date(a.when).getTime() : 0) - (b.when ? new Date(b.when).getTime() : 0));
  const seg = `<div class="seg" role="group" aria-label="Lists"><button type="button" data-ptab="maybe" aria-pressed="${peopleTab === 'maybe'}">Maybes (${d.maybes.filter(m => !m.stopped).length})</button><button type="button" data-ptab="booked" aria-pressed="${peopleTab === 'booked'}">Booked (${bookings.length})</button></div>`;
  let body;
  if (peopleTab === 'maybe') {
    body = d.maybes.length ? `<div class="list">${d.maybes.map(m => {
      const due = maybeDue(m);
      const plan = maybePlan(m);
      const dots = plan.map(p => `<i class="${m.sent && m.sent[p.step] ? 'on' : (due && due.step === p.step ? 'next' : '')}"></i>`).join('');
      const label = due ? (due.step === 'cb' ? 'Check-back text' : `Text ${due.index + 1}`) : '';
      const status = m.stopped ? 'Stopped. No more texts.' : due ? `${label} ${daysBetween(new Date(), due.due) <= 0 ? 'due today' : `on ${fmtDay(due.due)}`}` : 'All texts sent';
      return `<article class="person"><div class="person-top"><h3>${esc(m.first)}</h3><span class="meta">${fmtPhone(m.phone)}</span></div>
        <div class="dots" aria-label="${plan.filter(p => m.sent && m.sent[p.step]).length} of ${plan.length} texts sent">${dots}</div>
        <p class="meta">${esc(status)}. OK to text given ${fmtDay(m.consentAt)}.</p>
        <div class="person-actions">${!m.stopped ? `<button class="btn small ghost" type="button" data-stopm="${m.id}">They said stop</button>` : ''}<button class="btn small ghost" type="button" data-delm="${m.id}">Delete</button></div></article>`;
    }).join('')}</div>` : `<div class="empty"><h3>No maybes yet</h3><p class="muted">Tap Maybe on the Floor screen when an owner says "not today".</p></div>`;
  } else {
    body = bookings.length ? `<div class="list">${bookings.map(b => {
      const s = b.sent || {};
      const past = b.when && new Date(b.when) < new Date();
      const whenText = b.when ? `${past ? 'Was ' : ''}${fmtDay(b.when)}, ${fmtTime(b.when)}` : `Time not set${b.prefs && b.prefs.length ? `: ${prefsText(b.prefs).toLowerCase()}` : ''}`;
      const steps = [['now', 'Texted'], ['before', 'Day-before confirm'], ['neighbor', 'Neighbor link']].map(([k, l]) => `<span style="${s[k] > 0 ? '' : 'opacity:.45'}">${s[k] > 0 ? '✓ ' : ''}${l}</span>`).join('');
      return `<article class="person"><div class="person-top"><h3>${esc(b.first)} ${esc(b.last || '')}</h3><span class="meta">${esc(whenText)}</span></div>
        <div class="minitags">${steps}</div>
        <div class="person-actions"><button class="btn small ghost" type="button" data-book="${b.id}">${b.when ? 'Details for the tablet' : 'Details and set the time'}</button></div></article>`;
    }).join('')}</div>` : `<div class="empty"><h3>No bookings yet</h3><p class="muted">Tap Booked on the Floor screen, then Add for reminders.</p></div>`;
  }
  view.innerHTML = `${sampleNotice()}<header class="vhead"><h1>Your lists</h1><p>Only on this phone. Delete anyone who asks.</p></header>${seg}${body}`;
}

/* ---------- More ---------- */
function renderMore() {
  const d = load();
  const s = d.settings;
  const link = pageLink(s, { s: 'b' });
  view.innerHTML = `
    <header class="vhead"><h1>More</h1><p>Your details stay on this phone and go into your code and links.</p></header>
    <section class="card" aria-labelledby="you-h">
      <h2 id="you-h">You</h2>
      <div class="row2">
        <label class="field"><span>First name</span><input class="input" data-set="first" value="${esc(s.first)}" autocapitalize="words" placeholder="Your first name"></label>
        <label class="field"><span>Your mobile</span><input class="input" data-set="phone" type="tel" inputmode="tel" value="${esc(fmtPhone(s.phone))}" placeholder="(909) 555-0100"></label>
      </div>
      <label class="field"><span>Your Google Form's pre-filled link</span><input class="input" data-set="form" type="url" inputmode="url" value="${esc(s.form)}" placeholder="https://docs.google.com/forms/d/e/..."></label>
      <p class="small">${s.form ? (parseForm(s.form) ? '✓ Connected. Requests from your page go to your own Google Sheet.' : "<b>That link doesn't look right.</b> Type NAME, PHONE and DETAILS as the three answers, then copy the pre-filled link.") : 'Requests from your page go to your own free Google Form and Sheet.'} <a href="../setup/">How to set it up</a></p>
    </section>
    <section class="card"><h2>Your lists</h2><p>${d.maybes.length} maybes and ${d.bookings.length} bookings.</p><a class="btn small ghost" href="#people">Open your lists</a></section>
    <section class="card" aria-labelledby="link-h">
      <h2 id="link-h">Your page link</h2>
      <p>The same link as your code. It works in a TikTok or Instagram bio too.</p>
      <div class="linkbox">${esc(link)}</div>
      <div class="btnrow"><button class="btn small" type="button" data-act="share-link">${ICONS.share} Share</button><button class="btn small ghost" type="button" data-act="copy-link">${ICONS.copy} Copy</button><a class="btn small ghost" href="${esc(link)}">Open it</a></div>
    </section>
    <section class="card" aria-labelledby="print-h">
      <h2 id="print-h">Print (optional, for later)</h2>
      <div class="btnrow"><a class="btn small ghost" href="../print/?item=card">${ICONS.print} No-time cards</a><a class="btn small ghost" href="../print/?item=friend">Friend cards</a><a class="btn small ghost" href="../print/?item=sign">Counter sign</a></div>
      <label class="field"><span>Door hangers for a street where someone you booked just went solar</span><input class="input" id="hanger-street" placeholder="Street name, like Orchard Ave"></label>
      <div class="btnrow"><button class="btn small ghost" type="button" data-act="hanger">${ICONS.print} Door hangers</button></div>
      <p class="small">Anything set out at the booth needs your manager's OK. Door hangers go on doors or handles, never in mailboxes (federal law), and never name the neighbor.</p>
    </section>
    <section class="card" aria-labelledby="names-h">
      <h2 id="names-h">Names, once your manager OKs them</h2>
      <p>Leave these blank until then. Answers and texts show a placeholder instead.</p>
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
    <section class="card"><h2>Set it up on your phone</h2><p>Your free Google Form for requests, a ping when one comes in, this app on your home screen, and what to clear with your manager first.</p><a class="btn small" href="../setup/">Open the setup steps</a></section>
    <section class="card" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <p>${d.taps.length} chats, ${d.maybes.length} maybes and ${d.bookings.length} bookings, saved only on this phone. Add the app to your home screen so it's kept.</p>
      <div class="btnrow">
        <button class="btn small ghost" type="button" data-act="export">Save a backup</button>
        <label class="btn small ghost" for="import-file">Restore a backup</label><input type="file" id="import-file" accept="application/json" hidden>
        ${d.samples ? '<button class="btn small ghost" type="button" data-act="clear-samples">Clear sample data</button>' : ''}
        <button class="btn small ghost" type="button" data-act="replay-intro">Show the intro again</button>
        <button class="btn small ghost" type="button" data-act="erase">Erase everything</button>
      </div>
      <div id="erase-confirm" hidden class="notice"><span>Erase every chat, maybe and booking on this phone? This can't be undone.</span><button class="btn small" type="button" data-act="erase-yes">Erase</button></div>
    </section>`;
  view.querySelectorAll('[data-set]').forEach(inp => inp.addEventListener('change', () => {
    update(x => { x.settings[inp.dataset.set] = inp.dataset.set === 'phone' ? digits(inp.value) : inp.value.trim(); });
    if (inp.dataset.set === 'phone' && inp.value && !validPhone(inp.value)) toast('That mobile number needs 10 digits'); else toast('Saved on this phone');
    renderMore();
  }));
  view.querySelectorAll('[data-list]').forEach(inp => inp.addEventListener('change', () => {
    const vals = inp.value.split(',').map(v => v.trim()).filter(Boolean);
    update(x => {
      if (vals.length) x.settings[inp.dataset.list] = vals;
      if (!x.settings.stores.includes(x.ui.where)) x.ui.where = x.settings.stores[0];
      if (!x.settings.spots.includes(x.ui.spot)) x.ui.spot = x.settings.spots[0];
    });
    toast('Saved on this phone');
  }));
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { importJSON(await file.text()); toast('Backup restored'); route(); } catch (err) { toast(err.message); }
  });
}

/* ---------- First open: a three-screen intro ---------- */
const INTRO = [
  { icon: QR_ICON, cls: 'code', title: 'My code', text: 'No time to talk? Tap My code and let them scan your screen. They see their roof tonight and pick a time.' },
  { icon: ICONS.plus, cls: 'maybe', title: 'Maybe', text: 'Owner, but not today? Their first name and number, and their tick for texts. The follow-up texts get written for you.' },
  { icon: ICONS.check, cls: 'booked', title: 'Booked', text: "Booked one? One tap. Didn't? Tap Didn't book. That's all the floor ever asks of you." },
];
function intro(force = false) {
  if (!force && load().introDone) return;
  let i = 0;
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'How the coach works');
  const done = () => { update(d => { d.introDone = Date.now(); }); el.remove(); };
  const paint = () => {
    const step = INTRO[i];
    el.innerHTML = `<div class="intro-card">
      <div class="intro-btn ${step.cls}">${step.icon}<span>${step.title}</span></div>
      <p>${esc(step.text)}</p>
      <div class="intro-dots" aria-hidden="true">${INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn wide" type="button" data-next>${i < INTRO.length - 1 ? 'Next' : 'Start'}</button>
      ${i < INTRO.length - 1 ? '<button class="linkbtn" type="button" data-skip>Skip</button>' : ''}
    </div>`;
    el.querySelector('[data-next]').focus();
  };
  el.addEventListener('click', e => {
    if (e.target.closest('[data-next]')) { if (i < INTRO.length - 1) { i++; paint(); } else done(); }
    if (e.target.closest('[data-skip]')) done();
  });
  document.body.appendChild(el);
  paint();
}

/* ---------- one click handler for the whole view ---------- */
view.addEventListener('click', async e => {
  const flip = e.target.closest('[data-flip]');
  if (flip) { flip.setAttribute('aria-pressed', String(flip.getAttribute('aria-pressed') !== 'true')); return; }
  const ea = e.target.closest('[data-edit-answer]');
  if (ea) return editAnswer(ea.dataset.editAnswer);
  const eo = e.target.closest('[data-edit-opener]');
  if (eo) return editOpener(eo.dataset.editOpener);
  const pt = e.target.closest('[data-ptab]');
  if (pt) { peopleTab = pt.dataset.ptab; return renderPeople(); }
  const wk = e.target.closest('[data-week]');
  if (wk) { weekOffset = Number(wk.dataset.week); return renderWeek(); }
  const sm = e.target.closest('[data-stopm]');
  if (sm) { update(d => { const x = d.maybes.find(y => y.id === sm.dataset.stopm); if (x) x.stopped = Date.now(); }); toast('No more texts to them'); return renderPeople(); }
  const dm = e.target.closest('[data-delm]');
  if (dm) { update(d => { d.maybes = d.maybes.filter(m => m.id !== dm.dataset.delm); }); toast('Deleted from this phone'); return renderPeople(); }
  const bk = e.target.closest('[data-book]');
  if (bk) return bookingCard(load().bookings.find(b => b.id === bk.dataset.book));

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const d = load();
  switch (act.dataset.act) {
    case 'code': return showCode();
    case 'maybe': return addMaybe();
    case 'booked': return booked();
    case 'nobook': return noBook();
    case 'undo': return undoTap();
    case 'where': return pickFrom('Which store?', d.settings.stores, d.ui.where, v => { update(x => { x.ui.where = v; }); renderWeek(); });
    case 'spot': return pickFrom('Where in the store?', d.settings.spots, d.ui.spot, v => { update(x => { x.ui.spot = v; }); renderWeek(); });
    case 'clear-samples': clearSamples(); toast('Sample data cleared'); return route();
    case 'copy-prompt': (await copyText($('#prompt').textContent)) ? toast('Copied. Paste it into ChatGPT.') : toast('Copy blocked. Press and hold the text to copy.'); return;
    case 'share-link': { const res = await shareOrCopy({ title: 'See solar on your roof', text: 'See your roof from above and pick a time that works:', url: pageLink(d.settings, { s: 'b' }) }); if (res === 'copied') toast('Link copied'); return; }
    case 'copy-link': (await copyText(pageLink(d.settings, { s: 'b' }))) ? toast('Link copied') : toast('Copy blocked. Press and hold the link to copy.'); return;
    case 'hanger': { const st = ($('#hanger-street').value || '').trim(); location.href = `../print/?item=hanger${st ? `&st=${encodeURIComponent(st)}` : ''}`; return; }
    case 'export': download(`pocket-coach-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(), 'application/json'); toast('Backup saved to your downloads'); return;
    case 'replay-intro': return intro(true);
    case 'erase': $('#erase-confirm').hidden = false; return;
    case 'erase-yes': clearAll(); toast('Everything erased from this phone'); return route();
  }
});

/* ---------- start ---------- */
function boot() {
  const d = load();
  if (!d.taps.length && !d.maybes.length && !d.bookings.length && !d.firstRun) {
    const s = sampleData();
    update(x => { x.taps = s.taps; x.maybes = s.maybes; x.bookings = s.bookings; x.samples = true; x.firstRun = Date.now(); });
  }
  keepData();
  route();
  intro();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
boot();
