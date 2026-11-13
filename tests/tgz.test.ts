import { describe, expect, it } from 'vitest';
import { gzipSync, strToU8, zipSync } from 'fflate';
import { ingestFiles } from '../src/ingest';
import { TarReader } from '../src/tar';
import { fixtureBytes } from './helpers';

const file = (name: string, data: Uint8Array) => new File([data as BlobPart], name);

/** One 512-byte tar header with a valid checksum. */
function header(name: string, size: number, type = '0', prefix = ''): Uint8Array {
  const h = new Uint8Array(512);
  const put = (s: string, at: number) => h.set(strToU8(s), at);
  put(name.slice(0, 100), 0);
  put('0000644\0', 100);
  put(size.toString(8).padStart(11, '0') + '\0', 124);
  put('00000000000\0', 136);
  h[156] = type.charCodeAt(0);
  put('ustar\0', 257);
  put('00', 263);
  if (prefix) put(prefix, 345);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}

const padded = (d: Uint8Array) => {
  const out = new Uint8Array(Math.ceil(d.length / 512) * 512);
  out.set(d);
  return out;
};

type Entry = { name: string; data: Uint8Array; style?: 'ustar' | 'gnu' | 'pax' | 'dir' };

function tar(entries: Entry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const { name, data, style = 'ustar' } of entries) {
    if (style === 'dir') { parts.push(header(name, 0, '5')); continue; }
    if (style === 'gnu') {
      const n = strToU8(name + '\0');
      parts.push(header('././@LongLink', n.length, 'L'), padded(n), header(name.slice(0, 99), data.length));
    } else if (style === 'pax') {
      const body = ` path=${name}\n`;
      const n = strToU8(body).length;
      let len = n + 1;
      while (len !== n + String(len).length) len = n + String(len).length;
      const rec = strToU8(`${len}${body}`);
      parts.push(header('PaxHeader', rec.length, 'x'), padded(rec), header('short-name', data.length));
    } else {
      const cut = name.length > 100 ? name.lastIndexOf('/', name.length - 1) : -1;
      parts.push(cut > 0 ? header(name.slice(cut + 1), data.length, '0', name.slice(0, cut)) : header(name, data.length));
    }
    parts.push(padded(data));
  }
  parts.push(new Uint8Array(1024));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const watchJson = fixtureBytes('google/watch-history.json');
const WATCH = 'Takeout/YouTube and YouTube Music/history/watch-history.json';

describe('Google Takeout as .tgz', () => {
  it('gives the same events and report as the same Takeout as a .zip', async () => {
    const asZip = await ingestFiles([file('takeout-20261110T101500Z-001.zip', zipSync({ [WATCH]: watchJson }))]);
    const asTgz = await ingestFiles([file('takeout-20261110T101500Z-001.tgz', gzipSync(tar([
      { name: 'Takeout/', data: new Uint8Array(0), style: 'dir' },
      { name: 'Takeout/Google Photos/IMG_0001.jpg', data: new Uint8Array(3000).fill(7) },
      { name: WATCH, data: watchJson },
    ])))]);
    expect(asTgz.ignored).toEqual([]);
    expect(asTgz.events).toEqual(asZip.events);
    expect(asTgz.reports.map((r) => [r.format, r.events, r.file])).toEqual([['Google Takeout activity (JSON)', asZip.events.length, `takeout-20261110T101500Z-001.tgz/${WATCH}`]]);
  });

  it('reads long paths (ustar prefix, GNU long name, pax path), .tar.gz and plain .tar, and localized names by content', async () => {
    const deep = `Takeout/${'Sehr langer Ordnername '.repeat(5)}/history/watch-history.json`;
    for (const style of ['ustar', 'gnu', 'pax'] as const) {
      const r = await ingestFiles([file('t.tar.gz', gzipSync(tar([{ name: deep, data: watchJson, style }])))]);
      expect(r.reports[0]?.file, style).toBe(`t.tar.gz/${deep}`);
    }
    const plain = await ingestFiles([file('t.tar', tar([{ name: 'Takeout/YouTube und YouTube Music/Verlauf/Wiedergabeverlauf.json', data: watchJson }]))]);
    expect(plain.reports.map((r) => r.format)).toEqual(['Google Takeout activity (JSON)']);
  });

  it('explains a .tgz with no history, and a cut-short or mislabelled one, without failing the rest of the drop', async () => {
    const empty = await ingestFiles([file('takeout-20261110T101500Z-002.tgz', gzipSync(tar([{ name: 'Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv', data: strToU8('a,b') }])))]);
    expect(empty.ignored[0].hint).toMatch(/YouTube data but no watch or search history.*split into several archives/);
    const whole = gzipSync(tar([{ name: WATCH, data: watchJson }]));
    const r = await ingestFiles([
      file('cut.tgz', whole.subarray(0, Math.floor(whole.length / 2))),
      file('fake.tgz', gzipSync(strToU8('not a tar archive at all'.repeat(40)))),
      file('watch-history.json', watchJson),
    ]);
    expect(r.ignored.map((f) => f.file)).toEqual(['cut.tgz', 'fake.tgz']);
    for (const f of r.ignored) expect(f.hint).toMatch(/could not be read to the end.*pick \.zip/);
    expect(r.reports.map((x) => x.file)).toEqual(['watch-history.json']);
  });

  it('never reads an unsupported loose file into memory', async () => {
    const huge = { name: 'holiday.mp4', size: 5e9, stream: () => { throw new Error('read'); }, text: () => { throw new Error('read'); }, slice: () => { throw new Error('read'); } };
    const r = await ingestFiles([huge as never]);
    expect(r.ignored).toEqual([{ file: 'holiday.mp4', hint: 'Only .zip, .tgz, .json, .csv and .html exports can be read.' }]);
  });
});

describe('TarReader', () => {
  it('splits entries correctly whatever the chunk size, and passes over entries it was not asked for', () => {
    const bytes = tar([{ name: 'a.json', data: strToU8('x'.repeat(700)) }, { name: 'b.bin', data: new Uint8Array(513) }, { name: 'c.json', data: strToU8('[]') }]);
    for (const step of [1, 7, 511, 512, 4096]) {
      const got: Record<string, string> = {};
      const r = new TarReader((name) => (name.endsWith('.json') ? (d, final) => { got[name] = (got[name] ?? '') + new TextDecoder().decode(d) + (final ? '|' : ''); } : null));
      for (let o = 0; o < bytes.length; o += step) r.push(bytes.subarray(o, o + step));
      r.end();
      expect(got, `step ${step}`).toEqual({ 'a.json': 'x'.repeat(700) + '|', 'c.json': '[]|' });
    }
  });
});
