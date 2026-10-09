'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Chip } from '@/components/shell/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { clock, dayClock, formatDuration, secondsSince } from '@/lib/power';
import type { UPSEvent, UPSOutage } from '@/types';

const EVENT_TEXT: Record<string, string> = {
  'beeper:muted': 'Beeper muted from the dashboard',
  'beeper:unmuted': 'Beeper turned back on from the dashboard',
  'self_test:started': 'Self-test started',
  'self_test:stopped': 'Self-test stopped',
  'self_test:finished': 'Self-test finished',
};

type Row = { at: number; outage?: UPSOutage; event?: UPSEvent };

/** Power cuts, newest first, with dashboard actions as quieter rows. */
export function OutageList({
  outages,
  events,
  since,
  loading,
}: {
  outages: UPSOutage[];
  events: UPSEvent[];
  since: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Panel>
        <PanelHeader title="Power cuts" icon={<Zap />} />
        <Skeleton className="h-24 w-full" />
      </Panel>
    );
  }
  // Agent times can carry different zone offsets: sort by instant, not string.
  const rows: Row[] = [
    ...outages.map((o) => ({ at: new Date(o.start).getTime(), outage: o })),
    ...events.map((e) => ({ at: new Date(e.at).getTime(), event: e })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 40);

  return (
    <Panel>
      <PanelHeader title="Power cuts" icon={<Zap />} aside={<span className="num">{outages.length}</span>} />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-ink-3">
          {since
            ? `No power cuts recorded since ${new Date(since).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`
            : 'No power cuts recorded yet.'}
        </div>
      ) : (
        <ul className="-mx-4 divide-y divide-hairline-soft md:-mx-5">
          {rows.map((r, i) =>
            r.outage ? <OutageRow key={`o${r.at}`} o={r.outage} /> : <EventRow key={`e${r.at}-${i}`} e={r.event!} />
          )}
        </ul>
      )}
    </Panel>
  );
}

function OutageRow({ o }: { o: UPSOutage }) {
  const ongoing = !o.end;
  const facts = [
    o.lowestBatteryV > 0 ? `Battery fell to ${o.lowestBatteryV.toFixed(1)} V` : null,
    o.peakLoad > 0 ? `load peaked at ${o.peakLoad}%` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="num font-mono text-sm text-ink">
          {dayClock(o.start)}
          {o.end ? ` → ${dayClock(o.end)}` : ''}
        </span>
        <span className="flex items-center gap-2">
          {ongoing && <Chip tone="amber">On battery now</Chip>}
          {o.ranOut && <Chip tone="fault">Battery ran out</Chip>}
          <span className="num font-mono text-sm text-ink-2">
            {formatDuration(ongoing ? secondsSince(o.start) : o.durationSec)}
          </span>
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        {o.ranOut && o.ranOutAt
          ? `The battery ran out about ${clock(o.ranOutAt)}; power was back by ${o.end ? clock(o.end) : 'the time the Pi restarted'}. `
          : ''}
        {facts}
      </p>
    </li>
  );
}

function EventRow({ e }: { e: UPSEvent }) {
  const text = EVENT_TEXT[`${e.kind}:${e.detail}`] ?? `${e.kind} ${e.detail}`;
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2 md:px-5">
      <span className={cn('text-xs', e.ok ? 'text-ink-3' : 'text-fault')}>
        {text}
        {e.note ? ` · ${e.note}` : ''}
        {!e.ok && !e.note ? ' · failed' : ''}
      </span>
      <span className="num shrink-0 font-mono text-xs text-ink-4">{dayClock(e.at)}</span>
    </li>
  );
}
