import { hourLabel } from './format';

/**
 * A calendar reminder to come back once a requested export has arrived. Spotify, Apple and Netflix
 * exports take days, and nothing is stored here, so a visitor who requests one would otherwise have to
 * remember the address. The .ics file is built on this device and downloaded; nothing is sent.
 * It holds a fixed title and text, the reminder's date and time, the address of this page, and the
 * creation stamp and random ID every calendar event needs: nothing from the visitor's exports.
 */

/** The choices offered, in days from today. */
export const REMIND_DAYS = [3, 7, 30] as const;
export type RemindDays = (typeof REMIND_DAYS)[number];
/** Local time of the reminder: an evening, when the export can be downloaded on a computer. */
export const REMIND_HOUR = 18;
const LENGTH_MIN = 15;

export const REMINDER_TITLE = 'Your data exports may be ready: open Rewindary';

/** 18:00 local time, `days` calendar days after `now`. Built from date parts, so a DST change in between keeps it at 18:00. */
export function reminderStart(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, REMIND_HOUR, 0, 0, 0);
}

/** "Thu, Nov 19 at 6 PM". */
export function reminderLabel(start: Date): string {
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${hourLabel(start.getHours())}`;
}

/**
 * The address to put in the reminder: this page, without its query or fragment. Only for pages served
 * over HTTP(S); a copy opened from disk gets no address rather than a file path.
 */
export function appAddress(loc: { protocol: string; host: string; pathname: string }): string | null {
  return /^https?:$/.test(loc.protocol) && loc.host ? `${loc.protocol}//${loc.host}${loc.pathname}` : null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
/** Floating local time (no Z, no TZID): the calendar shows it at 18:00 wherever the visitor is. */
const local = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 TEXT escaping. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 line folding: at most 75 octets per line, continuation lines start with a space, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 75) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

export interface ReminderInput {
  now: Date;
  days: number;
  /** From appAddress(); null leaves the address out. */
  url: string | null;
  uid: string;
}

export function reminderIcs({ now, days, url, uid }: ReminderInput): string {
  const start = reminderStart(now, days);
  const end = new Date(start.getTime() + LENGTH_MIN * 60_000);
  const description = [
    'Look for the email from Spotify, Apple, Google or Netflix and download the zip.',
    url ? `Then open Rewindary and drop the zip in as it is: ${url}` : 'Then open Rewindary and drop the zip in as it is.',
    'Everything is read on your device. Spotify and Netflix say their exports can take up to 30 days.',
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rewindary//Export reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `SUMMARY:${icsText(REMINDER_TITLE)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(url ? [`URL:${url}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(REMINDER_TITLE)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** "rewindary-reminder-2026-11-19.ics". */
export function reminderFileName(now: Date, days: number): string {
  const d = reminderStart(now, days);
  return `rewindary-reminder-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.ics`;
}
