/** Small dependency-free text helpers shared by adapters (work in Workers and Node). */

export function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  eachCsvRow(text, (r) => { rows.push(r); });
  return rows;
}

/**
 * The same parser, one row at a time, so a large export (Apple Music play activity can hold
 * hundreds of thousands of 40-column rows) never becomes one huge array of arrays.
 */
export function eachCsvRow(text: string, onRow: (row: string[]) => void): void {
  const s = stripBom(text);
  const rows = { push: onRow };
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', emsp: ' ', ensp: ' ', thinsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/[\s  ]+/g, ' ').trim();
}

/**
 * Abbreviated month names as Takeout writes them in its HTML dates, lower-cased and without accents
 * (see `fold`), so "févr", "márc", "şub" and "Μαΐ" match "fevr", "marc", "sub" and "μαι". A token
 * matches in full, or by its first 4 or 3 letters ("juni" → "jun", "szept" → "sze").
 */
const MONTHS: Record<string, number> = {
  // English
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  // French
  janv: 0, fevr: 1, fev: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, aout: 7,
  // German, Dutch, Scandinavian, Hungarian
  mrz: 2, mrt: 2, mei: 4, maj: 4, okt: 9, dez: 11, des: 11, sze: 8,
  // Spanish, Italian, Portuguese, Romanian
  ene: 0, abr: 3, ago: 7, dic: 11, gen: 0, mag: 4, giu: 5, lug: 6, set: 8, ott: 9, out: 9, ian: 0, iun: 5, iul: 6,
  // Polish
  sty: 0, lut: 1, kwi: 3, cze: 5, lip: 6, sie: 7, wrz: 8, paz: 9, lis: 10, gru: 11,
  // Turkish, Indonesian
  oca: 0, sub: 1, nis: 3, haz: 5, tem: 6, agu: 7, agt: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
  // Russian
  янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, маи: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
  // Ukrainian
  січ: 0, лют: 1, бер: 2, кві: 3, тра: 4, чер: 5, лип: 6, сер: 7, вер: 8, жов: 9, лис: 10, гру: 11,
  // Greek
  ιαν: 0, φεβ: 1, μαρ: 2, απρ: 3, μαι: 4, ιουν: 5, ιουλ: 6, αυγ: 7, σεπ: 8, οκτ: 9, νοε: 10, δεκ: 11,
};

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function monthFromToken(tok: string): number | undefined {
  const t = fold(tok).replace(/\.$/, '');
  if (t in MONTHS) return MONTHS[t];
  for (const n of [4, 3]) {
    const p = t.slice(0, n);
    if (p.length === n && p in MONTHS) return MONTHS[p];
  }
  return undefined;
}

/** "GMT+1", "UTC+05:30", "[GMT+8]", Arabic "غرينتش+1": dropped first, so their digits are not read as a time or a day. */
const ZONE_OFFSET = /(?:GMT|UTC|غرينتش)\s?[+\-\u2212]\s?\d{1,2}(?::?\d{2})?/gi;
/** Times of day, tried in order. Each has the text before the time in group 1 and hours, minutes, seconds in 2–4. */
const TIMES = [
  /(^|\D)(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)/, // 21:05:02, 9:05:02 PM
  /(^|[^\d.])(\d{1,2})\.(\d{2})\.(\d{2})(?![\d.])/, // 21.05.02 (Danish, Finnish, Indonesian)
  /()(\d{1,2})\s*[시時]\s*(\d{1,2})\s*[분分](?:\s*(\d{1,2})\s*[초秒])?/, // 오후 9시 5분 2초, 21時05分02秒
];
const PM = /(?:^|[^\p{L}])(?:p\.?\s?m\.?|μ\.?\s?μ\.?)(?![\p{L}])|오후|午後|下午|中午|晚上|(?:^|\s)م(?!\p{L})/iu;
const AM = /(?:^|[^\p{L}])(?:a\.?\s?m\.?|π\.?\s?μ\.?)(?![\p{L}])|오전|午前|上午|凌晨|早上|清晨|(?:^|\s)ص(?!\p{L})/iu;

export type NumericDateOrder = 'dmy' | 'mdy';

/** The time of day, and the rest of the text with the zone offset and the time taken out. */
function splitStamp(input: string): { rest: string; h: number; m: number; s: number } | null {
  // Bidi marks (Arabic, Hebrew) are dropped, Arabic-Indic digits become 0–9, and narrow and no-break spaces plain spaces.
  const text = input
    .replace(/\p{Cf}/gu, '')
    .replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) & 0xf))
    .replace(/\s+/g, ' ')
    .replace(ZONE_OFFSET, ' ');
  for (const re of TIMES) {
    const t = text.match(re);
    if (!t) continue;
    const at = t.index! + t[1].length;
    const rest = text.slice(0, at) + ' ' + text.slice(t.index! + t[0].length);
    return { rest, h: Number(t[2]), m: Number(t[3]), s: Number(t[4] ?? 0) };
  }
  return null;
}

const isYear = (n: string) => /^(19|20)\d{2}$/.test(n);
const monthName = (rest: string) => {
  for (const tok of rest.match(/\p{L}+\.?/gu) ?? []) {
    const m = monthFromToken(tok);
    if (m !== undefined) return m;
  }
  return undefined;
};

/**
 * Numeric dates with the year last are day-first in every locale Takeout is known to write them in
 * ("07.03.2025", "07/03/2025"); month-first is chosen only when some date in the file cannot be day-first.
 */
export function numericDateOrder(texts: Iterable<string>): NumericDateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const text of texts) {
    const p = splitStamp(text);
    if (!p || monthName(p.rest) !== undefined) continue;
    const n = p.rest.match(/\d+/g) ?? [];
    if (n.length !== 3 || !isYear(n[2])) continue;
    if (Number(n[0]) > 12) dayFirst = true;
    if (Number(n[1]) > 12) monthFirst = true;
  }
  return monthFirst && !dayFirst ? 'mdy' : 'dmy';
}

/**
 * Tolerant parser for Google Takeout HTML timestamps, which are written in the account's language, e.g.
 * "Jan 5, 2024, 8:01:02 PM CET", "5 janv. 2024, 20:01:02 UTC", "05.01.2024, 20:01:02 MEZ",
 * "2024/01/05 20:01:02 JST", "2024. 1. 5. 오후 8:01:02 KST", "2024年1月5日 GMT+8 20:01:02",
 * "5 янв. 2024 г., 20:01:02 GMT+3" or "5.1.2024 klo 20.01.02 UTC+2".
 * A month name wins; otherwise a year-first date is year-month-day and a year-last one follows `order`.
 * The time zone is ignored and the time is interpreted as local time. Returns null for anything else,
 * and for impossible dates (no rolling 31.02 over into March).
 */
export function parseLooseDate(input: string, order: NumericDateOrder = 'dmy'): number | null {
  const p = splitStamp(input);
  if (!p) return null;
  const nums = p.rest.match(/\d+/g) ?? [];
  const yi = nums.findIndex(isYear);
  if (yi < 0) return null;
  const year = Number(nums[yi]);
  const others = nums.filter((_, i) => i !== yi).map(Number);
  let month = monthName(p.rest);
  let day: number | undefined;
  if (month !== undefined) day = others[0];
  else if (nums.length === 3 && yi === 0) [month, day] = [others[0] - 1, others[1]];
  else if (nums.length === 3 && yi === 2) [month, day] = order === 'mdy' ? [others[0] - 1, others[1]] : [others[1] - 1, others[0]];
  if (month === undefined || day === undefined) return null;

  let hour = p.h;
  if (hour > 23 || p.m > 59 || p.s > 59) return null;
  if (PM.test(p.rest)) { if (hour < 12) hour += 12; }
  else if (AM.test(p.rest) && hour === 12) hour = 0;
  const d = new Date(year, month, day, hour, p.m, p.s);
  return d.getMonth() === month && d.getDate() === day ? d.getTime() : null;
}

/** "HH:MM:SS" → ms */
export function parseDuration(s: string): number {
  const m = s.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (!m) return 0;
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000;
}

/** Parse "YYYY-MM-DD HH:MM[:SS]" as UTC. */
export function parseUtcStamp(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
}
