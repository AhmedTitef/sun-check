// Booth print kit: cards, counter sign and door hangers, with QR codes built
// from the rep's own settings on this phone. No name is stored in the page.

import { load } from './store.js';
import { $, $$, esc, fmtPhone, validPhone, pageLink } from './util.js';

const params = new URLSearchParams(location.search);
let item = ['card', 'friend', 'sign', 'hanger'].includes(params.get('item')) ? params.get('item') : 'card';
const st = load().settings;

function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-0.5 -0.5 ${n + 1} ${n + 1}" shape-rendering="crispEdges" role="img" aria-label="QR code"><path d="${d}" fill="#141f48"/></svg>`;
}

const name = () => (st.first ? esc(st.first) : '<span class="ph">Your name</span>');
const phone = () => (validPhone(st.phone) ? fmtPhone(st.phone) : '<span class="ph">your number</span>');

const NOTES = {
  card: '<b>For shoppers with no time.</b> Ten cards per letter sheet: use cardstock and cut on the dashed lines, or Avery 8371 business cards.',
  friend: '<b>For renters and for people you just booked.</b> They pass it to someone who owns. The QR works for whoever scans it.',
  sign: '<b>Needs your manager\'s OK</b> before it goes on the counter. Prints 5 by 7 inches; trim at the corner marks and use a tabletop frame.',
  hanger: '<b>Only for streets where someone you booked just went solar.</b> Hang it on the door or handle, never in a mailbox (federal law), and never name the neighbor.',
};

function card(kind) {
  const link = pageLink(st, { s: kind === 'friend' ? 'f' : 'c' });
  const svg = qrSvg(link);
  const one = kind === 'friend'
    ? `<div class="bc friend"><div class="bc-left"><div class="rays"></div><div class="sun"></div>
        <div><div class="bc-head slab">Pass it on</div><p class="bc-copy">For a friend or neighbor who owns. Scan to see solar on your roof, then pick a time that works.</p></div>
        <div class="bc-who">From ${name()} at the solar booth</div></div>
        <div class="bc-right"><div class="qr">${svg}</div><span>Scan with your camera</span></div></div>`
    : `<div class="bc"><div class="bc-left"><div class="rays"></div><div class="sun"></div>
        <div><div class="bc-head slab">No time today?</div><p class="bc-copy">See solar on your own roof, on your phone, later. Then pick a time that works.</p></div>
        <div class="bc-who">Questions? Text ${name()}<br>${phone()}</div></div>
        <div class="bc-right"><div class="qr">${svg}</div><span>Scan with your camera</span></div></div>`;
  return `<div class="page"><div class="cards">${one.repeat(10)}</div></div>`;
}

function cropMarks(x, y, w, h) {
  const m = [];
  const L = 0.3, G = 0.08;
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    const sx = cx === x ? -1 : 1, sy = cy === y ? -1 : 1;
    m.push(`<i class="crop" style="left:${sx < 0 ? cx - G - L : cx + G}in;top:${cy - 0.005}in;width:${L}in;height:0.01in"></i>`);
    m.push(`<i class="crop" style="left:${cx - 0.005}in;top:${sy < 0 ? cy - G - L : cy + G}in;width:0.01in;height:${L}in"></i>`);
  }
  return m.join('');
}

function sign() {
  const svg = qrSvg(pageLink(st, { s: 'k' }));
  return `<div class="page">
    <div class="sign"><div class="rays"></div><div class="sun"></div>
      <div class="sign-banner"><div class="sign-head slab">Not today?</div><p class="sign-sub">See solar on your own roof tonight, on your phone.</p></div>
      <div class="sign-qrwrap"><div class="qr">${svg}</div>
        <div class="sign-steps"><div><b>1</b>Scan</div><div><b>2</b>See your roof from above</div><div><b>3</b>Pick a time that works for you</div></div></div>
      <div class="sign-foot"><span>About a minute. No account.</span><span>${name()} at the solar booth</span></div>
    </div>
    ${cropMarks(1.75, 2, 5, 7)}
  </div>`;
}

const HOUSES = `<svg class="houses" viewBox="0 0 408 86" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <rect x="0" y="80" width="408" height="6" fill="#1a3591"/>
  <path d="M6 80V50l34-24 34 24v30z" fill="#1a3591"/>
  <path d="M86 80V44h86v36z" fill="#1a3591"/><path d="M80 46l49-26 49 26z" fill="#1a3591"/>
  <path d="M106 39l24-13 24 13z" fill="none" stroke="#f4cc2a" stroke-width="2.4"/>
  <path d="M112 36h36M118 32.5h24M124 29h12" stroke="#f4cc2a" stroke-width="1.6"/>
  <path d="M190 80V52l40-26 40 26v28z" fill="#1a3591"/>
  <path d="M284 80V48h60v32z" fill="#1a3591"/><path d="M278 50l36-22 36 22z" fill="#1a3591"/>
  <path d="M356 80V56l26-18 26 18v24z" fill="#1a3591"/>
  <path d="M238 80V30h3v50zM239.5 30c-9-1-14 4-17 9 5-4 10-5 17-6zm0 0c9-1 14 4 17 9-5-4-10-5-17-6zm0 0c-5-6-12-7-17-5 6 0 11 2 17 5zm0 0c5-6 12-7 17-5-6 0-11 2-17 5z" fill="#1a3591"/>
</svg>`;

function hanger() {
  const street = ($('#street').value || params.get('st') || '').trim();
  const svg = qrSvg(pageLink(st, { s: 'h', st: street }));
  const one = `<div class="hanger">
    <div class="hanger-top"><div class="rays"></div><div class="sun"></div><div class="slit"></div><div class="hole"></div>${HOUSES}</div>
    <div class="hanger-body">${street ? `<div class="hanger-street">Hello, ${esc(street)}!</div>` : ''}
      <div class="hanger-head slab">Your neighbor just went solar.</div>
      <p class="hanger-sub">Scan to see yours. You'll see your own roof from above and can pick a time that works, on your own phone.</p></div>
    <div class="hanger-qr"><div class="qr">${svg}</div><span>Point your camera here</span></div>
    <div class="hanger-foot"><span><b>No door knocking. No pressure.</b></span><span>Questions? Text ${name()} at ${phone()}</span></div>
  </div>`;
  return `<div class="page"><div class="hangers">${one}${one}</div></div>`;
}

function render() {
  $$('#tabs [data-item]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.item === item)));
  $('#note').innerHTML = NOTES[item];
  $('#street-field').hidden = item !== 'hanger';
  $('#who').innerHTML = st.first && validPhone(st.phone)
    ? `Printing with ${esc(st.first)}, ${fmtPhone(st.phone)}. Change it in the coach, under More.`
    : 'Add your first name and mobile in the coach, under More, so they print here. The QR already works.';
  const html = item === 'sign' ? sign() : item === 'hanger' ? hanger() : card(item);
  $('#stage').innerHTML = `<div class="scaler">${html}</div>`;
  fit();
  const u = new URL(location.href);
  u.searchParams.set('item', item);
  history.replaceState(null, '', u);
}

function fit() {
  const stage = $('#stage');
  const scaler = stage.querySelector('.scaler');
  if (!scaler) return;
  const page = scaler.firstElementChild;
  const w = page.offsetWidth, h = page.offsetHeight;
  const cs = getComputedStyle(stage);
  const avail = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const s = Math.min(1, avail / w);
  scaler.style.transform = `scale(${s})`;
  scaler.style.width = `${w}px`;
  scaler.style.marginLeft = `${Math.max(0, (avail - w * s) / 2)}px`;
  stage.style.height = `${h * s + 48}px`;
}

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-item]');
  if (!b) return;
  item = b.dataset.item;
  render();
});
$('#street').value = params.get('st') || '';
$('#street').addEventListener('input', () => { if (item === 'hanger') render(); });
$('#print').addEventListener('click', () => window.print());
window.addEventListener('resize', fit);
document.fonts && document.fonts.ready.then(fit);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
