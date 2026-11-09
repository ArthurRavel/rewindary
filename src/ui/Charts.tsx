import { dayClockArcs, SOURCE_COLOR, splitSegments } from '../charts';
import { MONTH_SHORT } from '../format';
import type { SourceId } from '../model';
import { SOURCE_LABEL, SOURCE_ORDER } from '../model';

export function SplitBar({ items }: { items: { source: SourceId; ms: number }[] }) {
  const segs = splitSegments(items, 1000, 8);
  return (
    <svg class="split" viewBox="0 0 1000 24" preserveAspectRatio="none" role="img" aria-label={segs.map((s) => `${SOURCE_LABEL[s.source]} ${Math.round(s.share * 100)}%`).join(', ')}>
      {segs.map((s, i) => (
        <rect key={s.source} x={s.x} y={0} width={s.w} height={24} rx={12} fill={s.color} style={`animation-delay:${i * 120}ms`} class="grow" />
      ))}
    </svg>
  );
}

export function DayClock({ hourly, label, value }: { hourly: Record<SourceId, number[]>; label: string; value: string }) {
  const arcs = dayClockArcs(hourly, 200, 200, 70, 170);
  return (
    <svg class="clock" viewBox="0 0 400 400" role="img" aria-label={`${label}: ${value}`}>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} class="bloom" style={`animation-delay:${a.hour * 30}ms`} />
      ))}
      <text x="200" y="192" text-anchor="middle" class="clock-label">{label}</text>
      <text x="200" y="228" text-anchor="middle" class="clock-value">{value}</text>
      {[['12A', 0], ['6A', 6], ['12P', 12], ['6P', 18]].map(([l, h]) => {
        const a = ((h as number) / 24) * Math.PI * 2 - Math.PI / 2;
        return <text key={l} x={200 + 188 * Math.cos(a)} y={206 + 188 * Math.sin(a)} text-anchor="middle" class="clock-tick">{l}</text>;
      })}
    </svg>
  );
}

export function MonthBars({ monthly }: { monthly: Record<SourceId, number[]> }) {
  const totals = MONTH_SHORT.map((_, m) => SOURCE_ORDER.reduce((n, k) => n + monthly[k][m], 0));
  const max = Math.max(1, ...totals);
  return (
    <svg class="months" viewBox="0 0 480 260" role="img" aria-label="Time per month by source">
      {MONTH_SHORT.map((label, m) => {
        let y = 230;
        return (
          <g key={label}>
            <g class="lift" style={`animation-delay:${m * 50}ms`}>
              {SOURCE_ORDER.map((k) => {
                const h = (monthly[k][m] / max) * 210;
                if (!h) return null;
                y -= h;
                return <rect key={k} x={m * 40 + 6} y={y} width={28} height={h} rx={4} fill={SOURCE_COLOR[k]} />;
              })}
            </g>
            <text x={m * 40 + 20} y={252} text-anchor="middle" class="tick">{label[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ sources }: { sources: SourceId[] }) {
  return (
    <ul class="legend">
      {sources.map((s) => (
        <li key={s}><i style={`background:${SOURCE_COLOR[s]}`} />{SOURCE_LABEL[s]}</li>
      ))}
    </ul>
  );
}
