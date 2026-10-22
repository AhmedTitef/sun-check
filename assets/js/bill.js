// Reads a power-bill photo on the phone itself. The image is never uploaded:
// the text recognizer (Tesseract, open source) runs in the browser.

import { loadScript } from './util.js';

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerPromise = null;

async function worker(onProgress) {
  if (!window.Tesseract) await loadScript(TESSERACT);
  if (!workerPromise) {
    workerPromise = window.Tesseract.createWorker('eng', 1, {
      logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
    });
  }
  return workerPromise;
}

// Shrink big photos first: faster, and plenty for a bill.
function shrink(file, max = 1800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d');
      ctx.filter = 'grayscale(1) contrast(1.25)';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c);
    };
    img.onerror = () => reject(new Error('That photo could not be opened.'));
    img.src = URL.createObjectURL(file);
  });
}

export async function readBill(file, onProgress) {
  const [canvas, w] = await Promise.all([shrink(file), worker(onProgress)]);
  const { data } = await w.recognize(canvas);
  return parseBill(data.text || '');
}

const money = s => Number(String(s).replace(/[$,\s]/g, ''));

// Pull the amount due, the kWh used, the days billed and the rate plan out of bill text.
export function parseBill(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  let amount = null, amountScore = -1;
  let kwh = null, kwhScore = -1;
  let days = null, plan = null;
  for (const line of lines) {
    const low = line.toLowerCase();
    for (const m of line.matchAll(/\$\s?(\d{1,4}(?:,\d{3})*\.\d{2})/g)) {
      const v = money(m[1]);
      if (v < 20 || v > 2500) continue;
      let score = 1;
      if (/(amount due|total due|total amount|please pay|new charges|balance due|amount you owe|you owe)/.test(low)) score = 5;
      else if (/total/.test(low)) score = 3;
      if (/(previous|payment received|last bill|credit)/.test(low)) score = 0;
      if (score > amountScore || (score === amountScore && v > amount)) { amount = v; amountScore = score; }
    }
    for (const m of line.matchAll(/(\d{1,2},?\d{3}|\d{2,4})(?:\.\d+)?\s*k\s?wh/gi)) {
      const v = money(m[1]);
      if (v < 50 || v > 6000) continue;
      if (/\$|per\s*kwh|\/\s*kwh/i.test(line.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6))) continue;
      let score = 1;
      if (/(total|used|usage|consumption|you used|this month|billing period)/.test(low)) score = 4;
      if (score > kwhScore || (score === kwhScore && v > kwh)) { kwh = v; kwhScore = score; }
    }
    const d = low.match(/(\d{2})\s*days/);
    if (d && !days) { const v = Number(d[1]); if (v >= 25 && v <= 40) days = v; }
    const p = line.match(/TOU-D-?\s?(4-9\s?PM|5-8\s?PM|PRIME)|TOU-D|Domestic|D-CARE|Schedule\s+D\b/i);
    if (p && !plan) plan = p[0].replace(/\s+/g, ' ').toUpperCase();
  }
  const perMonth = amount && days ? Math.round((amount * 30) / days) : amount ? Math.round(amount) : null;
  return { amount, kwh, days, plan, monthly: perMonth, found: Boolean(amount || kwh) };
}
