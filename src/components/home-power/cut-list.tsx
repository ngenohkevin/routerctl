'use client';

import { History } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Chip } from '@/components/shell/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { dayClock, formatDuration } from '@/lib/power';
import { cutDetail, eventText } from '@/lib/home-power';
import type { PowerCut, PowerEvent } from '@/types';

export function CutList({
  cuts,
  events,
  since,
  loading,
}: {
  cuts: PowerCut[];
  events: PowerEvent[];
  since: string | null;
  loading: boolean;
}) {
  return (
    <Panel className="space-y-4">
      <PanelHeader title="Power cuts" icon={<History />} />
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : cuts.length === 0 ? (
        <p className="text-sm text-ink-2">No power cuts{since ? ` since ${dayClock(since)}` : ''}.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {cuts.map((c) => (
            <li key={c.start} className="space-y-1 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-sm font-medium text-ink">
                  {dayClock(c.start)}
                  {c.end ? ` → ${dayClock(c.end)}` : ''}
                </span>
                <span className="num text-xs text-ink-2">{c.end ? formatDuration(c.durationSec) : 'going on'}</span>
                {c.test && <Chip tone="air">Test</Chip>}
                {!c.test && c.cause === 'blackout' && <Chip>Power cut</Chip>}
                {!c.test && c.cause === 'supply' && <Chip tone="amber">No supply</Chip>}
                {!c.test && c.cause === 'mains_off' && <Chip>Mains off</Chip>}
                {c.source === 'hikvision' && <Chip>Hikvision</Chip>}
                {c.ranOut && <Chip tone="fault">Battery ran out</Chip>}
              </div>
              {cutDetail(c).map((line) => (
                <p key={line} className="pl-0.5 text-xs text-ink-2">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">What the Pi did</h3>
          <ul className="space-y-1">
            {events.slice(0, 12).map((e) => (
              <li key={`${e.at}-${e.kind}-${e.detail}`} className="num flex gap-3 text-xs">
                <span className="w-20 shrink-0 font-mono text-ink-3">{dayClock(e.at)}</span>
                <span className={e.ok ? 'text-ink-2' : 'text-fault'}>{eventText(e)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
