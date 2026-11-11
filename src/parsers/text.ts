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

const MONTHS: Record<string, number> = {
  // English
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  // French
  janv: 0, 'févr': 1, fevr: 1, fév: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, 'août': 7, aout: 7, 'déc': 11,
  // German
  'mär': 2, mrz: 2, okt: 9, dez: 11,
  // Spanish / Italian / Portuguese
  ene: 0, abr: 3, ago: 7, dic: 11, gen: 0, mag: 4, giu: 5, lug: 6, set: 8, ott: 9, fev: 1, out: 9,
};

function monthFromToken(tok: string): number | undefined {
  const t = tok.toLowerCase().replace(/\.$/, '');
  if (t in MONTHS) return MONTHS[t];
  for (const n of [4, 3]) {
    const p = t.slice(0, n);
    if (p.length === n && p in MONTHS) return MONTHS[p];
  }
  return undefined;
}

/**
 * Tolerant parser for Google Takeout HTML timestamps, e.g.
 * "Jan 5, 2024, 8:01:02 PM CET", "5 Jan 2024, 20:01:02 CET", "5 janv. 2024, 20:01:02 UTC".
 * The time-zone abbreviation is ignored and the time is interpreted as local time.
 */
export function parseLooseDate(input: string): number | null {
  const s = input.replace(/[  ]/g, ' ');
  const year = s.match(/\b(19|20)\d{2}\b/);
  const time = s.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!year || !time) return null;
  let month: number | undefined;
  for (const tok of s.match(/[A-Za-zÀ-ÿ]+\.?/g) ?? []) {
    month = monthFromToken(tok);
    if (month !== undefined) break;
  }
  if (month === undefined) return null;
  const beforeTime = s.slice(0, time.index);
  const day = beforeTime.replace(year[0], ' ').match(/\b(\d{1,2})\b/);
  if (!day) return null;
  let hour = Number(time[1]);
  const ampm = s.match(/\b([ap])\.?\s?m\.?(?=\s|$|[^a-z])/i);
  if (ampm) {
    const pm = ampm[1].toLowerCase() === 'p';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const d = new Date(Number(year[0]), month, Number(day[1]), hour, Number(time[2]), Number(time[3] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
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
