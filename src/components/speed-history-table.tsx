'use client';

import { Panel, PanelHeader } from '@/components/shell/panel';
import { cn } from '@/lib/utils';
import { bufferbloatGrade, formatMbps, formatMs, gradeTone, loadedRise } from '@/lib/speed';
import type { NetSpeedTestResult } from '@/types';

const GRADE_TEXT = { link: 'text-link', amber: 'text-amber', fault: 'text-fault', ink: 'text-ink-3' } as const;

function when(ts: string) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Load({ r }: { r: NetSpeedTestResult }) {
  const rise = loadedRise(r.ping, r.latencyDown, r.latencyUp);
  if (rise == null) return <span className="text-ink-4">—</span>;
  const g = bufferbloatGrade(rise);
  return (
    <span className={GRADE_TEXT[gradeTone(g)]}>
      +{formatMs(rise)} <span className="text-ink-4">{g}</span>
    </span>
  );
}

/** Saved results: a table on desktop, a stacked list on phones. */
export function SpeedHistoryTable({ results }: { results: NetSpeedTestResult[] }) {
  if (results.length === 0) return null;

  return (
    <Panel className="p-0 md:p-0">
      <PanelHeader title="Results" className="mb-0 px-4 pt-4 pb-3 md:px-5" />

      {/* Phone: stacked rows, the figures get the width */}
      <ul className="divide-y divide-hairline-soft border-t border-hairline-soft md:hidden">
        {results.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-ink">{r.wanLabel || r.isp || '—'}</span>
              <span className="shrink-0 text-ink-3">{when(r.timestamp)}</span>
            </div>
            <div className="num mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-sm">
              <span className="text-link">↓ {formatMbps(r.download)}</span>
              <span className="text-air">↑ {formatMbps(r.upload)}</span>
              <span className="text-ink-2">{formatMs(r.ping)} ms</span>
              <span className="text-xs"><Load r={r} /></span>
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-4">{r.server.sponsor}, {r.server.name}</div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-hairline-soft text-left">
              {['When', 'Line', 'Server', 'Download', 'Upload', 'Ping', 'Bufferbloat'].map((h, i) => (
                <th key={h} className={cn('eyebrow px-5 py-2 font-medium', i >= 3 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-soft">
            {results.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-raised/40">
                <td className="px-5 py-2.5 text-xs whitespace-nowrap text-ink-3">{when(r.timestamp)}</td>
                <td className="px-5 py-2.5 text-xs font-medium text-ink">{r.wanLabel || r.isp || '—'}</td>
                <td className="max-w-48 truncate px-5 py-2.5 text-xs text-ink-3">{r.server.sponsor}</td>
                <td className="num px-5 py-2.5 text-right font-mono text-link">{formatMbps(r.download)}</td>
                <td className="num px-5 py-2.5 text-right font-mono text-air">{formatMbps(r.upload)}</td>
                <td className="num px-5 py-2.5 text-right font-mono text-ink-2">{formatMs(r.ping)} ms</td>
                <td className="num px-5 py-2.5 text-right font-mono text-xs"><Load r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
