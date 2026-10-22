// Fill-in texts the rep sends by hand from her own phone, one tap each.
// Nothing here sends anything: it only writes the words. Every text names the
// sender and carries a STOP line, as California requires for marketing texts.

import { CADENCE } from './content.js';
import { fmtWhen, fmtTime, pageLink } from './util.js';

const me = s => (s.first || 'your rep').trim();
const from = s => s.company ? `${me(s)} with ${s.company.trim()}` : `${me(s)} from the solar booth`;
const STOP = 'Reply STOP to opt out.';

// A personal link: their first name and address ride in the #fragment, so the
// page opens with their roof ready and they only pick times.
export function maybeLink(settings, m = {}) { return pageLink(settings, { s: 'm', n: m.first, a: m.address }); }
// A neighbor link carries only who sent it, never the sender's address.
export function neighborLink(settings, who) { return pageLink(settings, { s: 'n', ref: who }); }

export const PREFS = { eve: 'Weekday evenings', day: 'Weekday daytime', sat: 'Saturday', sun: 'Sunday' };
export const prefsText = p => (p || []).map(k => PREFS[k] || k).join(', ');

// Six touches over about eight weeks. Touch 2 answers the reason they gave.
export function maybeText(step, m, settings) {
  const r = me(settings);
  const link = maybeLink(settings, m);
  const tag = (m.tags || [])[0];
  switch (step) {
    case 0:
      if (tag === 'spouse') return `Hi ${m.first}, it's ${from(settings)}. Here's your roof check to show your partner tonight. It opens with your roof ready, and you can pick a time together that works for both of you: ${link} Reply STOP and I won't text again.`;
      return `Hi ${m.first}, it's ${from(settings)}. Here's the roof check I mentioned. It takes about a minute: you'll see your roof from above and can pick an evening or weekend time if you want. ${link} Reply STOP and I won't text again.`;
    case 'cb':
      return `Hi ${m.first}, it's ${from(settings)}. You said to check back ${m.checkNote ? m.checkNote : 'around now'}, so here I am! No pressure. Your roof check is ready whenever you are, and you can pick a time that works: ${link} ${STOP}`;
    case 1: {
      const byTag = {
        spouse: `Hi ${m.first}, ${r} here. You said your partner weighs in too. Here's the same link to send them so you both see the same roof: ${link}`,
        cost: `Hi ${m.first}, ${r} here. On cost: meeting the consultant costs nothing and there's nothing to sign that day. You'd see buy, lease and monthly options side by side. ${link}`,
        credit: `Hi ${m.first}, ${r} here. You asked about the tax credit. The homeowner credit for buying ended after 2025, but leases and monthly plans work differently. The consultant can show you what still applies: ${link}`,
        roof: `Hi ${m.first}, ${r} here. You mentioned your roof's age. The consultant checks the roof first and tells you straight if it should be redone before solar. ${link}`,
        hoa: `Hi ${m.first}, ${r} here. On the HOA question: California's Solar Rights Act stops HOAs from banning solar, though they can set reasonable rules. The consultant helps with the paperwork. ${link}`,
        moving: `Hi ${m.first}, ${r} here. You mentioned you might move. That's a good thing to ask the consultant about, since each option handles a sale differently. ${link}`,
        bill: `Hi ${m.first}, ${r} here. You said your bill's been high. The roof check gives a rough idea of what your roof could do: ${link}`,
        busy: `Hi ${m.first}, ${r} here. No rush at all. Evenings and weekends are open whenever it suits you: ${link}`,
      };
      return `${byTag[tag] || `Hi ${m.first}, ${r} here. Just making sure the link came through. It shows your roof from above and lets you pick a time that works: ${link}`} ${STOP}`;
    }
    case 2:
      return `Hi ${m.first}, quick tip from ${r}: on Edison's time-of-use plans, power costs the most from 4 to 9 PM, which is why batteries matter under California's current solar rules. Your roof check is here whenever you want it: ${link} ${STOP}`;
    case 3:
      return `Hi ${m.first}, ${r} here. Evenings and weekends are open next week if that's easier. It's about an hour, and it's best if everyone on the title can be there: ${link} ${STOP}`;
    case 4:
      return `Hi ${m.first}, it's ${r}. Still thinking about solar? No pressure at all. If this summer's bills stung, now is a good time to see real numbers before next summer: ${link} ${STOP}`;
    case 5:
      return `Hi ${m.first}, last note from me so I'm not bugging you. If you ever want to see your numbers, this link keeps working: ${link} Thanks for stopping by the booth! ${STOP}`;
    default:
      return '';
  }
}

// The texts a maybe will get, in order. With a check-back date, the plan is:
// a thank-you that night, a check-back text on the day they named, then two
// gentle follow-ups. Without one, six touches over about eight weeks.
export function maybePlan(m) {
  const start = new Date(m.start || m.consentAt || Date.now());
  const at = (base, days) => { const d = new Date(base); d.setDate(d.getDate() + days); d.setHours(17, 0, 0, 0); return d; };
  if (m.checkBack) {
    const cb = new Date(`${m.checkBack}T17:00`);
    return [{ step: 0, due: at(start, 0) }, { step: 'cb', due: cb }, { step: 4, due: at(cb, 14) }, { step: 5, due: at(cb, 42) }];
  }
  return CADENCE.map((n, i) => ({ step: i, due: at(start, n) }));
}

export function maybeDue(m) {
  if (m.stopped) return null;
  const plan = maybePlan(m);
  const i = plan.findIndex(p => !(m.sent && m.sent[p.step]));
  return i < 0 ? null : { ...plan[i], index: i, total: plan.length };
}

const whoLine = b => b.both === 'both' ? 'both owners' : b.both === 'one' ? 'the other owner too, if you can' : '';

// Right after a request: reply within five minutes. Requests carry preferred
// times; the rep offers two real times from the tablet's consultant calendar.
export function confirmNowText(b, settings) {
  const how = b.type === 'call' ? ' by phone or video' : '';
  if (!b.when) {
    const pref = prefsText(b.prefs);
    return `Hi ${b.first}, it's ${from(settings)}. Thanks for your request${pref ? ` (${pref.toLowerCase()})` : ''}! The consultant can meet you${how} [day and time] or [day and time]. Which works better? ${STOP}`;
  }
  return `Hi ${b.first}, it's ${from(settings)}. You're set for ${fmtWhen(b.when)}${how} with the solar consultant. Reply YES to confirm, or text me a time that works better. ${STOP}`;
}

// One to two days before: the personal confirm that makes it stick.
export function confirmBeforeText(b, settings) {
  const r = me(settings);
  const who = whoLine(b);
  const ready = who ? `having ${who} there, and a recent power bill handy (a photo works)` : 'a recent power bill handy (a photo works)';
  return `Hi ${b.first}, ${r} here. Quick check on ${fmtWhen(b.when)} with the solar consultant. Two things make it worth your time: ${ready}. It's a no-pressure look at real numbers for your home, and if it's not a fit, no hard feelings. Still good for ${fmtTime(b.when)}? ${STOP}`;
}

export function voiceMemoScript(b, settings) {
  const r = me(settings);
  const who = b.both === 'both' ? 'both of you can be there' : b.both === 'one' ? 'everyone on the title can be there' : 'you have the hour free';
  return `Hey ${b.first}, it's ${r}. Just a quick voice note to confirm ${fmtWhen(b.when)}. The consultant will walk you through real numbers for your house, and it takes about an hour. It really helps if ${who} and you've got a recent power bill handy, even a photo on your phone. No pressure at all. If the time doesn't work anymore, just text me and I'll move it. Talk soon!`;
}

// After their appointment: every booking gets a neighbor link.
export function neighborText(b, settings) {
  const reward = (settings.reward || '').trim();
  return `Thanks again, ${b.first}! It's ${from(settings)}. If a neighbor ever asks about solar, here's a link just for them. They'll see their own roof and can pick a time on their own phone: ${neighborLink(settings, b.first)}${reward ? ` ${reward}` : ''} ${STOP}`;
}
