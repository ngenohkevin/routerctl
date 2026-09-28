'use client';

import { cn } from '@/lib/utils';
import { formatMbps } from '@/lib/speed';
import type { TracePoint } from '@/hooks/use-speed-test';

const W = 200;
const H = 44;

function paths(points: TracePoint[], max: number) {
  if (points.length < 2) return null;
  const xy = points.map((p) => [p.at * W, H - (Math.min(p.mbps, max) / max) * (H - 2) - 1] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  return { line, area: `${line} L${last[0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z` };
}

function Lane({
  label,
  points,
  max,
  tone,
  active,
}: {
  label: string;
  points: TracePoint[];
  max: number;
  tone: 'link' | 'air';
  active: boolean;
}) {
  const p = paths(points, max);
  const color = tone === 'link' ? 'var(--link)' : 'var(--air)';
  const top = points.reduce((m, q) => Math.max(m, q.mbps), 0);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={cn('eyebrow', active && (tone === 'link' ? 'text-link' : 'text-air'))}>{label}</span>
        {top > 0 && <span className="num font-mono text-[11px] text-ink-4">peak {formatMbps(top)}</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-11 w-full rounded-md border border-hairline-soft bg-inset"
        aria-hidden
      >
        {p && (
          <>
            <path d={p.area} fill={color} fillOpacity={0.12} />
            <path d={p.line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * The line's behaviour through each transfer — the second-by-second rate the
 * gauge showed, kept on screen. Both lanes share one vertical scale so
 * download and upload compare at a glance.
 */
export function SpeedTrace({
  download,
  upload,
  phase,
}: {
  download: TracePoint[];
  upload: TracePoint[];
  phase: string | null;
}) {
  if (download.length < 2 && upload.length < 2) return null;
  const max = Math.max(10, ...download.map((p) => p.mbps), ...upload.map((p) => p.mbps)) * 1.08;
  return (
    <div className="grid w-full grid-cols-2 gap-3">
      <Lane label="Download" points={download} max={max} tone="link" active={phase === 'download'} />
      <Lane label="Upload" points={upload} max={max} tone="air" active={phase === 'upload'} />
    </div>
  );
}
