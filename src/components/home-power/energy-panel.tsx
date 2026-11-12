'use client';

import { Zap } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/power';
import { costText, energyTotals, kwh, type EnergyTotal } from '@/lib/home-power';
import type { PowerEnergyDay } from '@/types';

const dayCount = (n: number) => (n === 1 ? '1 day' : `${n} days`);

function Period({ label, t, tariff, span }: { label: string; t: EnergyTotal | null; tariff?: number; span: string }) {
  if (!t) {
    return (
      <li className="flex items-baseline justify-between gap-3 py-2.5">
        <span className="text-sm text-ink-2">{label}</span>
        <span className="text-xs text-ink-3">no readings</span>
      </li>
    );
  }
  const cost = costText(t.wallWh, tariff);
  const facts = [
    `wall ${kwh(t.wallWh)}${cost ? ` = ${cost}` : ''}`,
    t.batteryWh > 0.5 ? `battery ${kwh(t.batteryWh)}` : null,
    t.chargedWh > 0.5 ? `charging ${kwh(t.chargedWh)}` : null,
    t.tvInUseSec > 0 ? `TV in use ${formatDuration(t.tvInUseSec)}` : null,
  ].filter(Boolean);
  return (
    <li className="space-y-0.5 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-2">{label}</span>
        <span className="num font-mono text-sm text-ink">{kwh(t.loadWh)} used</span>
      </div>
      <p className="num font-mono text-xs text-ink-3">
        {facts.join(' · ')} · measured {formatDuration(t.measuredSec)}
        {span}
      </p>
    </li>
  );
}

/** Energy through the Delta per day: what the house used from it, what it drew from the wall, and the cost. */
export function EnergyPanel({ days, tariffKSh, loading }: { days: PowerEnergyDay[]; tariffKSh?: number; loading: boolean }) {
  const t = energyTotals(days);
  return (
    <Panel className="space-y-3">
      <PanelHeader title="Energy" icon={<Zap />} />
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-sm text-ink-3">
          No energy figures yet: they start once the Pi reads the Delta’s watts.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-hairline-soft">
            <Period label="Today" t={t.today} tariff={tariffKSh} span=" so far" />
            <Period label="Yesterday" t={t.yesterday} tariff={tariffKSh} span="" />
            <Period label="Last 7 days" t={t.week} tariff={tariffKSh} span={t.week ? ` over ${dayCount(t.week.days)}` : ''} />
            <Period label="Last 30 days" t={t.month} tariff={tariffKSh} span={t.month ? ` over ${dayCount(t.month.days)}` : ''} />
          </ul>
          <p className="text-xs text-ink-3">
            Used is what the network and the TV group drew from the Delta. Wall is what the Delta drew from the socket, charging
            included{tariffKSh ? `; the cost is the wall figure at KSh ${tariffKSh}/kWh` : ''}. Time without readings isn’t counted.
            {!tariffKSh && ' Set your electricity price under Settings to see the cost.'}
          </p>
        </>
      )}
    </Panel>
  );
}
