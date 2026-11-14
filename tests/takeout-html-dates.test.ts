import { describe, expect, it } from 'vitest';
import { parseTextFile } from '../src/ingest';
import { numericDateOrder, parseLooseDate } from '../src/parsers/text';

// Tests run in UTC (scripts/run-tests.mjs), so a parsed local time reads back as the same ISO string.
const iso = (s: string, order?: 'dmy' | 'mdy') => {
  const t = parseLooseDate(s, order);
  return t === null ? null : new Date(t).toISOString();
};

// Each locale's CLDR medium date with a long time, as ICU writes it for 7 March and 13 May 2025
// (Node's Intl.DateTimeFormat, dateStyle "medium", timeStyle "long"): Takeout writes its HTML dates
// in the account's language. Strings are pinned here so an ICU update cannot change the test.
const MARCH = '2025-03-07T21:05:02.000Z';
const MAY = '2025-05-13T09:15:00.000Z';
const LOCALES: [string, string, string][] = [
  ['de', '07.03.2025, 21:05:02 MEZ', '13.05.2025, 09:15:00 MESZ'],
  ['pt-PT', '07/03/2025, 21:05:02 CET', '13/05/2025, 09:15:00 CEST'],
  ['nl', '7 mrt 2025, 21:05:02 CET', '13 mei 2025, 09:15:00 CEST'],
  ['sv', '7 mars 2025 21:05:02 CET', '13 maj 2025 09:15:00 CEST'],
  ['da', '7. mar. 2025, 21.05.02 CET', '13. maj 2025, 09.15.00 CEST'],
  ['fi', '7.3.2025 klo 21.05.02 UTC+1', '13.5.2025 klo 9.15.00 UTC+2'],
  ['pl', '7 mar 2025, 21:05:02 CET', '13 maj 2025, 09:15:00 CEST'],
  ['cs', '7. 3. 2025 21:05:02 SEČ', '13. 5. 2025 9:15:00 SELČ'],
  ['ru', '7 мар. 2025 г., 21:05:02 GMT+1', '13 мая 2025 г., 09:15:00 GMT+2'],
  ['uk', '7 бер. 2025 р., 21:05:02 GMT+1', '13 трав. 2025 р., 09:15:00 GMT+2'],
  ['ja', '2025/03/07 21:05:02 GMT+1', '2025/05/13 9:15:00 GMT+2'],
  ['ko', '2025. 3. 7. 오후 9시 5분 2초 GMT+1', '2025. 5. 13. 오전 9시 15분 0초 GMT+2'],
  ['zh-CN', '2025年3月7日 GMT+1 21:05:02', '2025年5月13日 GMT+2 09:15:00'],
  ['zh-TW', '2025年3月7日 晚上9:05:02 [GMT+1]', '2025年5月13日 上午9:15:00 [GMT+2]'],
  ['id', '7 Mar 2025, 21.05.02 GMT+1', '13 Mei 2025, 09.15.00 GMT+2'],
  ['vi', '21:05:02 GMT+1 7 thg 3, 2025', '09:15:00 GMT+2 13 thg 5, 2025'],
  ['hu', '2025. márc. 7. 21:05:02 CET', '2025. máj. 13. 9:15:00 CEST'],
  ['el', '7 Μαρ 2025, 9:05:02 μ.μ. CET', '13 Μαΐ 2025, 9:15:00 π.μ. CEST'],
  ['ar', '07‏/03‏/2025، 9:05:02 م غرينتش+1', '13‏/05‏/2025، 9:15:00 ص غرينتش+2'],
  ['ar-EG', '٠٧‏/٠٣‏/٢٠٢٥، ٩:٠٥:٠٢ م غرينتش+١', '١٣‏/٠٥‏/٢٠٢٥، ٩:١٥:٠٠ ص غرينتش+٢'],
  ['en-US','Mar 7, 2025, 9:05:02 PM GMT+1', 'May 13, 2025, 9:15:00 AM GMT+2'],
  ['fr', '7 mars 2025, 21:05:02 UTC+1', '13 mai 2025, 09:15:00 UTC+2'],
  ['pt-BR', '7 de mar. de 2025, 21:05:02 GMT+1', '13 de mai. de 2025, 09:15:00 GMT+2'],
  ['ro', '7 mar. 2025, 21:05:02 CET', '13 mai 2025, 09:15:00 CEST'],
  ['tr', '7 Mar 2025 21:05:02 GMT+1', '13 May 2025 09:15:00 GMT+2'],
];

describe('Takeout HTML dates in the account language', () => {
  it.each(LOCALES)('%s', (_, march, may) => {
    expect(iso(march)).toBe(MARCH);
    expect(iso(may)).toBe(MAY);
  });

  it('reads month names that only some languages use', () => {
    expect(iso('5 janv. 2025, 08:00:00 UTC')).toBe('2025-01-05T08:00:00.000Z'); // fr
    expect(iso('5 ian. 2025, 08:00:00 EET')).toBe('2025-01-05T08:00:00.000Z'); // ro
    expect(iso('5 sty 2025, 08:00:00 CET')).toBe('2025-01-05T08:00:00.000Z'); // pl
    expect(iso('5 Şub 2025 08:00:00 GMT+3')).toBe('2025-02-05T08:00:00.000Z'); // tr
    expect(iso('5 paź 2025, 08:00:00 CEST')).toBe('2025-10-05T08:00:00.000Z'); // pl
    expect(iso('5. des. 2025, 08:00:00 CET')).toBe('2025-12-05T08:00:00.000Z'); // nb
    expect(iso('2025. szept. 5. 8:00:00 CEST')).toBe('2025-09-05T08:00:00.000Z'); // hu
    expect(iso('5 Ιουν 2025, 8:00:00 π.μ. EEST')).toBe('2025-06-05T08:00:00.000Z'); // el
    expect(iso('5 Ιουλ 2025, 8:00:00 μ.μ. EEST')).toBe('2025-07-05T20:00:00.000Z'); // el
    expect(iso('5 лист. 2025 р., 08:00:00 GMT+2')).toBe('2025-11-05T08:00:00.000Z'); // uk
  });

  it('keeps the forms that already worked', () => {
    expect(iso('Dec 31, 2024, 12:05:00 AM CET')).toBe('2024-12-31T00:05:00.000Z');
    expect(iso('Dec 31, 2024, 12:05:00 PM CET')).toBe('2024-12-31T12:05:00.000Z');
    expect(iso('1 févr. 2025, 07:00:00 UTC')).toBe('2025-02-01T07:00:00.000Z');
    expect(iso('3. Okt. 2025, 18:20:00 MESZ')).toBe('2025-10-03T18:20:00.000Z');
    expect(iso('7 mar 2025, 9:05:02 p. m. CET')).toBe('2025-03-07T21:05:02.000Z');
    expect(iso('Mar 7, 2025, 9:05:02 PM GMT+01:00')).toBe('2025-03-07T21:05:02.000Z');
  });

  it('never invents a date', () => {
    expect(iso('garbage')).toBeNull();
    expect(iso('31.02.2025, 10:00:00 MEZ')).toBeNull(); // no rolling over into March
    expect(iso('2025/13/01 10:00:00 JST')).toBeNull();
    expect(iso('07.03.2025, 25:00:00 MEZ')).toBeNull();
    expect(iso('07.03.2025')).toBeNull(); // no time of day
    expect(iso('7 במרץ 2025, 21:05:02')).toBeNull(); // Hebrew month names are not known
    expect(iso('7 มี.ค. 2568 21:05:02')).toBeNull(); // Buddhist-era years are not read
    expect(iso('۱۷ اسفند ۱۴۰۳، ۲۱:۰۵:۰۲ (UTC)')).toBeNull(); // nor Persian-calendar years
  });

  it('reads a year-last numeric date month-first only when the file cannot be day-first', () => {
    expect(numericDateOrder(['07/03/2025, 21:05:02 CET', '13/05/2025, 09:15:00 CEST'])).toBe('dmy');
    expect(numericDateOrder(['03/07/2025, 21:05:02', '05/13/2025, 09:15:00'])).toBe('mdy');
    expect(numericDateOrder(['03/07/2025, 21:05:02', '04/08/2025, 09:15:00'])).toBe('dmy'); // ambiguous: day-first
    expect(numericDateOrder(['Mar 7, 2025, 9:05:02 PM', '2025/05/13 9:15:00'])).toBe('dmy'); // nothing year-last and numeric
    expect(iso('03/07/2025, 21:05:02', 'mdy')).toBe(MARCH);
    expect(iso('03/07/2025, 21:05:02')).toBe('2025-07-03T21:05:02.000Z');
    expect(iso('2025/03/07 21:05:02', 'mdy')).toBe(MARCH); // year-first is always year-month-day
  });
});

const cell = (url: string, title: string, date: string) =>
  `<div class="outer-cell mdl-cell"><div class="header-cell"><p class="mdl-typography--title">YouTube<br></p></div>` +
  `<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Angesehen:&nbsp;<a href="${url}">${title}</a><br>` +
  `<a href="https://www.youtube.com/channel/UC1">Synthetic Channel</a><br>${date}<br></div></div>`;

describe('a German Takeout watch history in HTML (Takeout’s default format)', () => {
  const html = '<html><body><div class="mdl-grid">' +
    cell('https://www.youtube.com/watch?v=AAAAAAAAAAA', 'Synthetic video one', '07.03.2025, 21:05:02 MEZ') +
    cell('https://www.youtube.com/watch?v=BBBBBBBBBBB', 'Synthetic video two', '13.05.2025, 09:15:00 MESZ') +
    cell('https://www.youtube.com/results?search_query=synthetic+private+query', 'synthetic private query', '13.05.2025, 09:10:00 MESZ') +
    '</div></body></html>';
  const r = parseTextFile('Takeout/YouTube und YouTube Music/Verlauf/Wiedergabeverlauf.html', html);

  it('is read in full, with no undated-entry warning', () => {
    expect(r?.report.format).toBe('Google Takeout activity (HTML)');
    expect(r?.events.map((e) => [e.kind, new Date(e.t).toISOString()])).toEqual([
      ['video', MARCH], ['video', MAY], ['search', '2025-05-13T09:10:00.000Z'],
    ]);
    expect(r?.report.warnings).toEqual([]);
    expect(JSON.stringify(r?.events)).not.toContain('private query');
  });
});
