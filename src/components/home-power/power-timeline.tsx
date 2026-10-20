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
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <span />
            <div className="num flex justify-between font-mono text-[11px] text-ink-3">
              {ticks.map((t) => (
                <span key={t}>{clock(t)}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-3">Amber: a power cut. Grey on the mains row: the Pi couldn’t see the plugs.</p>
        </div>
      )}
    </Panel>
  );
}
