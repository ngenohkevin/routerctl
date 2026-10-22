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
 * A line (y on a 0–100 scale, 0 at the top) as runs of minutes with a
 * reading. A gap of more than 2 minutes breaks it; a change between mains and
 * battery starts a new run that joins the last point, so the line stays whole
 * while its colour changes.
 */
function valueRuns(points: PowerPoint[], start: number, y: (p: PowerPoint) => number | null): Run[] {
  const runs: Run[] = [];
  let prev = -Infinity;
  for (const p of points) {
    const t = new Date(p.t).getTime();
    const v = y(p);
    if (v == null || t + 60_000 <= start) {
      prev = -Infinity;
      continue;
    }
    const pt: [number, number] = [Math.max(0, ((t + 30_000 - start) / DAY) * W), v];
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

/** An area chart row: the runs, amber where the Delta ran on battery. */
function ChartRow({ label, note, runs, aria }: { label: string; note?: string; runs: Run[]; aria: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3">
      <span className="text-xs leading-tight text-ink-2">
        {label}
        {note && <span className="num block text-[11px] text-ink-3">{note}</span>}
      </span>
      <div className="relative h-12 overflow-hidden rounded-sm bg-raised" role="img" aria-label={aria}>
        <svg viewBox={`0 -3 ${W} 106`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {runs.map((r) => (
            <g key={`${r.pts[0][0]}-${r.battery}`}>
              <path d={areaPath(r.pts)} className={r.battery ? 'fill-amber/25' : 'fill-link/15'} />
              <path
                d={linePath(r.pts)}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
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

function inWindow(points: PowerPoint[], start: number, has: (p: PowerPoint) => boolean): PowerPoint[] {
  return points.filter((p) => has(p) && new Date(p.t).getTime() + 60_000 > start);
}

/** The Delta's % on a 0–100 scale. */
function DeltaRow({ points, start }: { points: PowerPoint[]; start: number }) {
  const seen = inWindow(points, start, (p) => p.charge != null);
  if (seen.length === 0) return null;
  const low = Math.min(...seen.map((p) => p.charge!));
  const latest = seen[seen.length - 1].charge!;
  return (
    <ChartRow
      label="Delta"
      note={low < latest ? `low ${low}%` : undefined}
      runs={valueRuns(points, start, (p) => (p.charge == null ? null : 100 - p.charge))}
      aria={`The Delta's charge over the last 24 hours: ${latest}% now, lowest ${low}%`}
    />
  );
}

/** The load on the Delta, scaled to the day's peak (at least 60 W, so the network alone sits low). */
function LoadRow({ points, start }: { points: PowerPoint[]; start: number }) {
  const seen = inWindow(points, start, (p) => p.outW != null);
  if (seen.length === 0) return null;
  const peak = Math.max(...seen.map((p) => p.outW!));
  const top = Math.max(60, peak);
  const latest = seen[seen.length - 1].outW!;
  return (
    <ChartRow
      label="Load"
      note={`peak ${peak} W`}
      runs={valueRuns(points, start, (p) => (p.outW == null ? null : 100 - (Math.min(p.outW, top) / top) * 100))}
      aria={`The load on the Delta over the last 24 hours: ${latest} W now, peak ${peak} W`}
    />
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
          <LoadRow points={series} start={start} />
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <span />
            <div className="num flex justify-between font-mono text-[11px] text-ink-3">
              {ticks.map((t) => (
                <span key={t}>{clock(t)}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-3">
            Amber: a power cut, or the Delta running on battery. Grey on the mains row: the Pi couldn’t see the plugs. Load: what
            the Delta supplies, the network alone about 20 W, more while the TV is in use.
          </p>
        </div>
      )}
    </Panel>
  );
}
