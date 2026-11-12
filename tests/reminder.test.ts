import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REMINDER_TITLE, appAddress, foldLine, icsText, reminderFileName, reminderIcs, reminderLabel, reminderStart } from '../src/reminder';

const APP = 'https://arthurravel.github.io/rewindary/';
const NOW = new Date(2026, 10, 12, 13, 0, 0); // Nov 12 2026, 13:00 local (UTC in this run)
const ics = (over: Partial<Parameters<typeof reminderIcs>[0]> = {}) => reminderIcs({ now: NOW, days: 7, url: APP, uid: 'test-uid@rewindary', ...over });
/** Undo RFC 5545 folding, then split into content lines. */
const unfold = (s: string) => s.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
const prop = (s: string, name: string) => unfold(s).filter((l) => l.startsWith(`${name}:`)).map((l) => l.slice(name.length + 1));

describe('export reminder date', () => {
  const realTz = process.env.TZ;
  afterEach(() => {
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  });

  it('is 6 PM local time, whole calendar days later, across months and years', () => {
    expect(reminderStart(NOW, 7)).toEqual(new Date(2026, 10, 19, 18, 0, 0));
    expect(reminderStart(new Date(2026, 0, 28, 23, 59), 7)).toEqual(new Date(2026, 1, 4, 18));
    expect(reminderStart(new Date(2026, 11, 29, 9), 3)).toEqual(new Date(2027, 0, 1, 18));
    expect(reminderStart(new Date(2028, 1, 27, 9), 3)).toEqual(new Date(2028, 2, 1, 18)); // leap year: Feb 29 counts
  });

  it('stays at 6 PM across a daylight-saving change', () => {
    // Europe/Paris leaves summer time on 25 Oct 2026; adding 7 × 24 h would land at 5 PM.
    process.env.TZ = 'Europe/Paris';
    const start = reminderStart(new Date(2026, 9, 20, 20, 0), 7);
    expect([start.getDate(), start.getHours()]).toEqual([27, 18]);
    const text = reminderIcs({ now: new Date(2026, 9, 20, 20, 0), days: 7, url: null, uid: 'u' });
    expect(prop(text, 'DTSTART')).toEqual(['20261027T180000']);
  });

  it('is described in plain words and names the file after the day', () => {
    expect(reminderLabel(reminderStart(NOW, 7))).toBe('Thu, Nov 19 at 6 PM');
    expect(reminderFileName(NOW, 30)).toBe('rewindary-reminder-2026-12-12.ics');
  });
});

describe('export reminder file', () => {
  it('is a single calendar event with an alert, in CRLF lines', () => {
    const text = ics();
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const lines = unfold(text);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.indexOf('BEGIN:VALARM')).toBeGreaterThan(lines.indexOf('BEGIN:VEVENT'));
    expect(lines.indexOf('END:VALARM')).toBeLessThan(lines.indexOf('END:VEVENT'));
    for (const p of ['VERSION', 'PRODID', 'UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY']) expect(prop(text, p).length, p).toBeGreaterThan(0);
    expect(prop(text, 'ACTION')).toEqual(['DISPLAY']);
    expect(prop(text, 'TRIGGER')).toEqual(['PT0S']);
    // A DISPLAY alarm needs its own DESCRIPTION.
    expect(prop(text, 'DESCRIPTION')).toHaveLength(2);
  });

  it('uses floating local times for the event and UTC for the stamp', () => {
    const text = ics();
    expect(prop(text, 'DTSTART')).toEqual(['20261119T180000']);
    expect(prop(text, 'DTEND')).toEqual(['20261119T181500']);
    expect(prop(text, 'DTSTAMP')).toEqual(['20261112T130000Z']);
    expect(text).not.toMatch(/TZID/);
  });

  it('keeps every line within 75 octets and unfolds back to the original', () => {
    const long = `${APP}${'deep/'.repeat(30)}é—`;
    const text = ics({ url: long });
    for (const l of text.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(prop(text, 'URL')).toEqual([long]);
    // A multi-byte character is never split across a fold.
    expect(foldLine('X'.repeat(74) + 'é')).toBe('X'.repeat(74) + '\r\n é');
    expect(foldLine('short')).toBe('short');
  });

  it('escapes text values', () => {
    expect(icsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const summary = prop(ics(), 'SUMMARY')[0];
    expect(summary).toBe(icsText(REMINDER_TITLE));
  });

  it("carries only this page's address, and none when there is no web address", () => {
    const text = ics();
    expect([...unfold(text).join('\n').matchAll(/https?:\/\/[^\s\\]+/g)].map((m) => m[0])).toEqual([APP, APP]);
    expect(prop(text, 'URL')).toEqual([APP]);
    const offline = ics({ url: null });
    expect(offline).not.toMatch(/https?:|URL:/);
    expect(prop(offline, 'DESCRIPTION')[0]).toMatch(/drop the zip in as it is\.\\n/);
  });

  it('holds only fixed text: the same inputs give the same file', () => {
    expect(ics()).toBe(ics());
    expect(ics({ days: 3 })).not.toBe(ics());
  });
});

describe('the address put in a reminder', () => {
  it('is this page without query or fragment, and only over HTTP(S)', () => {
    expect(appAddress({ protocol: 'https:', host: 'arthurravel.github.io', pathname: '/rewindary/' })).toBe(APP);
    // location.pathname never includes ?query or #hash, so they cannot leak into the file.
    expect(appAddress(new URL('http://127.0.0.1:4173/rewindary/?demo=1#story'))).toBe('http://127.0.0.1:4173/rewindary/');
    expect(appAddress(new URL('file:///home/me/rewindary/dist/index.html'))).toBeNull();
  });

  it('is read from the page at runtime, never pinned in the source', () => {
    // The dist scan allows the app's own URL only in index.html's link-preview tags.
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'reminder.ts'), 'utf8');
    expect(src).not.toMatch(/https?:\/\//);
    expect(readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'Reminder.tsx'), 'utf8')).toMatch(/appAddress\(location\)/);
  });
});
