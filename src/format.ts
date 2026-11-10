import { dayToDate } from './insights';

const nf = new Intl.NumberFormat('en-US');
export const num = (n: number) => nf.format(Math.round(n));

export function hours(ms: number): string {
  const h = ms / 3_600_000;
  if (h >= 10) return nf.format(Math.round(h));
  return h.toFixed(1).replace(/\.0$/, '');
}

export function duration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Signed change from `prev` to `cur`: "+23%", "−12%", "±0%", or "3.4×" once it more than triples. */
export function change(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? 'new' : '±0%';
  const r = cur / prev;
  if (r >= 3) return `${r.toFixed(1).replace(/\.0$/, '')}×`;
  const p = Math.round((r - 1) * 100);
  return p === 0 ? '±0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
}

export function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const v = h % 12 === 0 ? 12 : h % 12;
  return `${v} ${ampm}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const monthName = (m: number) => MONTHS[m];
/** "Nov 9". */
export const shortDate = (month: number, date: number) => `${MONTH_SHORT[month]} ${date}`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Exact: "Saturday, March 15". Vague (privacy default): "a Saturday in March". */
export function dayLabel(day: number, exact: boolean): string {
  const d = dayToDate(day);
  const wd = WEEKDAYS[d.getUTCDay()];
  const m = MONTHS[d.getUTCMonth()];
  return exact ? `${wd}, ${m} ${d.getUTCDate()}` : `a ${wd} in ${m}`;
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function wrap(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncate(kept[maxLines - 1] + ' …', maxChars);
    return kept;
  }
  return lines;
}
