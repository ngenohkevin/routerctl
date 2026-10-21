'use client';

import { Activity } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { clock } from '@/lib/power';
import { useNow } from '@/lib/use-now';
import type { PowerPoint } from '@/types';

const DAY = 24 * 3600_000;

interface Seg {
  from: number;
  to: number;
  v: string;
}

/** Runs of equal values; a gap of more than 2 minutes breaks the run (no data). */
function segments(points: PowerPoint[], get: (p: PowerPoint) => string): Seg[] {
  const out: Seg[] = [];
  for (const p of points) {
    const t = new Date(p.t).getTime();
    const v = get(p);
    const last = out[out.length - 1];
    if (last && last.v === v && t - last.to <= 2 * 60_000) {
      last.to = t + 60_000;
    } else {
      out.push({ from: t, to: t + 60_000, v });
    }
  }
  return out;
}

const MAINS_FILL: Record<string, string> = { on: 'bg-link/55', unknown: 'bg-ink-4/40', off: 'bg-amber' };
const TV_FILL: Record<string, string> = { on: 'bg-link/55', off: 'bg-ink-4/30', none: '' };

function Row({ label, segs, fill, start }: { label: string; segs: Seg[]; fill: Record<string, string>; start: number }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3">
      <span className="text-xs text-ink-2">{label}</span>
      <div className="relative h-4 overflow-hidden rounded-sm bg-raised">
        {segs.map((s) => {
          const left = Math.max(0, ((s.from - start) / DAY) * 100);
          const width = Math.max(0.15, ((Math.min(s.to, start + DAY) - Math.max(s.from, start)) / DAY) * 100);
          if (s.to <= start || !fill[s.v]) return null;
          return <span key={s.from} className={`absolute inset-y-0 ${fill[s.v]}`} style={{ left: `${left}%`, width: `${width}%` }} />;
        })}
      </div>
    </div>
  );
}

const W = 1000; // the battery chart's width in its own units

interface Run {
  battery: boolean;
  pts: [number, number][];
}

/**
 * The battery line as runs of minutes with a reading. A gap of more than 2
 * minutes breaks it; a change between mains and battery starts a new run
 * that joins the last point, so the line stays whole while its colour changes.
 */
function chargeRuns(points: PowerPoint[], start: number): Run[] {
  const runs: Run[] = [];
  let prev = -Infinity;
  for (const p of points) {
    const t = new Date(p.t).getTime();
    if (p.charge == null || t + 60_000 <= start) {
      prev = -Infinity;
      continue;
    }
    const pt: [number, number] = [Math.max(0, ((t + 30_000 - start) / DAY) * W), 100 - p.charge];
    const battery = !!p.onBattery;
    const last = runs[runs.length - 1];
    if (last && t - prev <= 2 * 60_000) {
      if (last.battery === battery) last.pts.push(pt);
      else runs.push({ battery, pts: [last.pts[last.pts.length - 1], pt] });
    } else {
      runs.push({ battery, pts: [pt] });
    }
    prev = t;
  }
  return runs;
}

/** A lone minute is drawn one minute wide. */
function widen(pts: [number, number][]): [number, number][] {
  if (pts.length > 1) return pts;
  const half = W / 1440 / 2;
  return [
    [pts[0][0] - half, pts[0][1]],
    [pts[0][0] + half, pts[0][1]],
  ];
}

function linePath(pts: [number, number][]): string {
  return widen(pts)
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y}`)
    .join('');
}

function areaPath(pts: [number, number][]): string {
  const p = widen(pts);
  return `${linePath(p)}L${p[p.length - 1][0].toFixed(1)},100L${p[0][0].toFixed(1)},100Z`;
}

/** The Delta's % on a 0–100 scale, amber where it ran on battery. */
function DeltaRow({ points, start }: { points: PowerPoint[]; start: number }) {
  const seen = points.filter((p) => p.charge != null && new Date(p.t).getTime() + 60_000 > start);
  if (seen.length === 0) return null;
  const runs = chargeRuns(points, start);
  const low = Math.min(...seen.map((p) => p.charge!));
  const latest = seen[seen.length - 1].charge!;
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3">
      <span className="text-xs leading-tight text-ink-2">
        Delta
        {low < latest && <span className="num block text-[11px] text-ink-3">low {low}%</span>}
      </span>
      <div
        className="relative h-12 overflow-hidden rounded-sm bg-raised"
        role="img"
        aria-label={`The Delta's charge over the last 24 hours: ${latest}% now, lowest ${low}%`}
      >
        <svg viewBox={`0 -3 ${W} 106`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {runs.map((r) => (
            <g key={`${r.pts[0][0]}-${r.battery}`}>
              <path d={areaPath(r.pts)} className={r.battery ? 'fill-amber/25' : 'fill-link/15'} />
              <path
                d={linePath(r.pts)}
                fill="none"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className={r.battery ? 'stroke-amber' : 'stroke-link'}
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function PowerTimeline({ series, loading }: { series: PowerPoint[]; loading: boolean }) {
  const end = useNow(60_000); // the window slides once a minute
  const start = end - DAY;
  const ticks = [0, 6, 12, 18, 24].map((h) => start + h * 3600_000);
  return (
    <Panel className="space-y-3">
      <PanelHeader title="Last 24 hours" icon={<Activity />} />
      {loading ? (
        <Skeleton className="h-14 w-full" />
      ) : (
        <div className="space-y-2">
          <Row label="Mains" segs={segments(series, (p) => p.mains)} fill={MAINS_FILL} start={start} />
          <Row label="TV group" segs={segments(series, (p) => (p.tvOn === null ? 'none' : p.tvOn ? 'on' : 'off'))} fill={TV_FILL} start={start} />
          <DeltaRow points={series} start={start} />
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <span />
            <div className="num flex justify-between font-mono text-[11px] text-ink-3">
              {ticks.map((t) => (
                <span key={t}>{clock(t)}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-3">
            Amber: a power cut, or the Delta running on battery. Grey on the mains row: the Pi couldn’t see the plugs.
          </p>
        </div>
      )}
    </Panel>
  );
}
