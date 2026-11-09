import { describe, expect, it } from 'vitest';
import { cardLines, renderCardSvg, shownLines, type RevealId } from '../src/cards';
import { computeInsights } from '../src/insights';
import type { LifeEvent } from '../src/model';
import { loadDemo } from '../src/pipeline';

const demo = loadDemo(2025);
const ins = computeInsights(demo.events, 2025);
const none = new Set<RevealId>();
const allNames = [...new Set(demo.events.flatMap((e) => [e.title, e.group, e.profile ?? '']).filter((s) => s.length > 3))];

const svgText = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('share-card redaction', () => {
  for (const format of ['story', 'square'] as const) {
    for (const theme of ['dusk', 'paper'] as const) {
      it(`${format}/${theme}: default card contains no names, titles, profiles, URLs or exact dates`, () => {
        const svg = renderCardSvg(ins, { format, theme, reveal: none });
        const text = svgText(svg).join('\n');
        for (const n of allNames) expect(text, n).not.toContain(n.replace(/&/g, '&amp;'));
        expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|www\.|\.com/);
        expect(text).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
        expect(text).not.toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December) \d/);
        expect(svg).toMatch(/^<svg[^>]+width="1080" height="(1920|1080)"/);
      });
    }
  }

  it('every personal line is hidden by default and listed for review', () => {
    const lines = cardLines(ins, none);
    const personal = lines.filter((l) => l.revealId);
    expect(personal.map((l) => l.revealId).sort()).toEqual(['exactDay', 'topArtist', 'topChannel', 'topShow']);
    expect(personal.every((l) => !l.revealed)).toBe(true);
    expect(lines.find((l) => l.id === 'topArtist')!.value).toMatch(/^••••• · \d/);
    expect(lines.find((l) => l.id === 'busiest')!.value).toMatch(/^a \w+day in \w+ · /);
  });

  it('the card contains exactly the reviewed lines (story format)', () => {
    const reveal = new Set<RevealId>(['topArtist']);
    const svg = renderCardSvg(ins, { format: 'story', theme: 'dusk', reveal });
    const text = svgText(svg);
    const top = ins.sources.find((s) => s.source === 'spotify')!.top[0].name;
    expect(text.some((t) => t.startsWith(top.replace(/&/g, '&amp;')))).toBe(true);
    for (const l of shownLines(ins, reveal, 'story')) expect(text.join('\n')).toContain(l.id === 'peak' ? l.value : l.label);
    for (const l of shownLines(ins, reveal, 'square')) expect(svgText(renderCardSvg(ins, { format: 'square', theme: 'paper', reveal }))).toContain(l.label);
  });

  it('escapes user-controlled names', () => {
    const evil: LifeEvent[] = [{ source: 'spotify', kind: 'music', t: Date.UTC(2025, 0, 1), ms: 300_000, est: false, title: 't', group: '<script>alert(1)</script>&' }];
    const svg = renderCardSvg(computeInsights(evil, 2025), { format: 'story', theme: 'dusk', reveal: new Set(['topArtist']) });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});
