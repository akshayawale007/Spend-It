export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const pad = (n: number) => String(n).padStart(2, '0');
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100 + 0; // + 0 turns -0 into 0

/** 100000 → "1,00,000" (en-IN grouping, up to 2 decimals). */
export const numStr = (n: number) => round2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Money: ₹1,00,000 / −₹500 */
export const fmt = (n: number) => (n < 0 ? '−' : '') + '₹' + numStr(Math.abs(n));

/** Parses user input like "1,200.50" or "₹ 300". Returns NaN when invalid or over 2 decimals. */
export function parseAmt(v: string | number): number {
  const s = String(v).replace(/[,₹\s]/g, '');
  if (!/^\d*\.?\d{0,2}$/.test(s) || s === '' || s === '.') return NaN;
  const x = parseFloat(s);
  return isFinite(x) ? round2(x) : NaN;
}

export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = (now = new Date()) => isoOf(now);
export const curKey = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

export function shiftKey(k: string, n: number) {
  let [y, m] = k.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${pad(m)}`;
}

export const monthName = (k: string) => MONTHS[Number(k.slice(5)) - 1];
export const monthShort = (k: string) => monthName(k).slice(0, 3);
export const monthLabel = (k: string) => `${monthName(k)} ${k.slice(0, 4)}`;

/** "2026-09-03" → "03 Sep 2026" (built by hand so it never says "Sept"). */
export function fullDate(s: string | null | undefined) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d} ${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
}

/** New spends default to today in the current month, otherwise the 1st of the month. */
export const defaultDate = (monthKey: string, now = new Date()) =>
  monthKey === curKey(now) ? todayISO(now) : `${monthKey}-01`;
