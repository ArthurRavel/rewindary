import type { SourceId } from './model';
import { SOURCE_ORDER } from './model';

export const SOURCE_COLOR: Record<SourceId, string> = {
  spotify: '#3ddc97',
  applemusic: '#5cc8ff',
  youtube: '#ff6b6b',
  netflix: '#ffb547',
  google: '#9b8cff',
};

export interface Arc { d: string; color: string; source: SourceId; hour: number }

/** 24 stacked radial bars ("day clock"). Midnight at the top, clockwise. */
export function dayClockArcs(hourly: Record<SourceId, number[]>, cx: number, cy: number, r0: number, r1: number): Arc[] {
  const totals = new Array(24).fill(0).map((_, h) => SOURCE_ORDER.reduce((n, k) => n + hourly[k][h], 0));
  const max = Math.max(1, ...totals);
  const arcs: Arc[] = [];
  const step = (Math.PI * 2) / 24;
  const pad = step * 0.12;
  for (let h = 0; h < 24; h++) {
    let r = r0;
    const a0 = h * step + pad - Math.PI / 2;
    const a1 = (h + 1) * step - pad - Math.PI / 2;
    for (const k of SOURCE_ORDER) {
      const v = hourly[k][h];
      if (!v) continue;
      const rNext = r + (v / max) * (r1 - r0);
      arcs.push({ d: sector(cx, cy, r, rNext, a0, a1), color: SOURCE_COLOR[k], source: k, hour: h });
      r = rNext;
    }
  }
  return arcs;
}

function sector(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(ri, a0)} L${p(ro, a0)} A${ro.toFixed(1)} ${ro.toFixed(1)} 0 0 1 ${p(ro, a1)} L${p(ri, a1)} A${ri.toFixed(1)} ${ri.toFixed(1)} 0 0 0 ${p(ri, a0)} Z`;
}

export interface Segment { source: SourceId; share: number; x: number; w: number; color: string }

export function splitSegments(items: { source: SourceId; ms: number }[], width: number, gap = 6): Segment[] {
  const list = items.filter((i) => i.ms > 0);
  const total = list.reduce((n, i) => n + i.ms, 0);
  const usable = width - gap * Math.max(0, list.length - 1);
  let x = 0;
  return list.map((i) => {
    const w = Math.max(4, (i.ms / total) * usable);
    const seg = { source: i.source, share: i.ms / total, x, w, color: SOURCE_COLOR[i.source] };
    x += w + gap;
    return seg;
  });
}
