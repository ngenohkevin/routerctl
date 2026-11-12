'use client';

import { BatteryCharging } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Chip } from '@/components/shell/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { chargingText, isDeltaProblem, timeoutText } from '@/lib/home-power';
import type { PowerDelta, PowerDeltaSettings, PowerProblem } from '@/types';

// The alert limits on the Pi (internal/power/delta_health.go).
const CELL_LIMIT = 45;
const MOS_LIMIT = 75;

type Row = { label: string; value: string; warn?: string; note?: string };

function onOff(v: boolean | undefined): string {
  return v == null ? '—' : v ? 'On' : 'Off';
}

function settingRows(s: PowerDeltaSettings): Row[] {
  const ac = s.acTimeoutMin;
  return [
    {
      label: 'AC timeout',
      value: timeoutText(ac),
      warn: ac != null && ac !== 0 ? 'Should be Never: the sockets, the network included, can switch off when the load is low.' : undefined,
    },
    {
      label: 'Output memory',
      value: onOff(s.outputMemory),
      warn: s.outputMemory === false ? 'Should be on: after a restart the AC sockets would stay off.' : undefined,
    },
    {
      label: 'Bypass',
      value: s.bypassOff == null ? '—' : s.bypassOff ? 'Off' : 'On',
      note: s.bypassOff ? 'Off: on mains the sockets run from the battery.' : undefined,
    },
    {
      label: 'Beep',
      value: onOff(s.beep),
      note: s.beep ? 'It beeps each time the Pi logs in over Bluetooth; turn Beep off in the EcoFlow app to stop that.' : undefined,
    },
    { label: 'Unit timeout', value: timeoutText(s.unitTimeoutMin) },
    { label: 'USB/DC timeout', value: timeoutText(s.dcTimeoutMin) },
    { label: 'X-Boost', value: onOff(s.xBoost) },
  ];
}

function tempText(name: string, c: number | undefined): string {
  return c == null ? `${name} —` : `${name} ${c} °C`;
}

/** What the Delta reports over Bluetooth: fault codes, heat, how it charges and its settings. Read-only. */
export function DeltaPanel({
  delta,
  problems,
  loading,
}: {
  delta: PowerDelta | null | undefined;
  problems: PowerProblem[];
  loading: boolean;
}) {
  const ins = delta?.insights;
  const own = problems.filter((p) => isDeltaProblem(p.code));
  const hot = (ins?.cellTempC ?? 0) >= CELL_LIMIT || (ins?.mosTempC ?? 0) >= MOS_LIMIT;
  const faults = ins?.faults ?? [];
  const charging = chargingText(ins?.settings);

  return (
    <Panel tone={own.length > 0 ? 'amber' : undefined} className="space-y-3">
      <PanelHeader title="Delta" icon={<BatteryCharging />} aside={ins ? 'over Bluetooth' : undefined} />
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : !ins ? (
        <p className="text-sm text-ink-2">
          Bluetooth isn’t reading the Delta{delta?.bluetoothError ? ` (${delta.bluetoothError})` : ''}, so its fault codes, heat and
          settings aren’t known right now.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {faults.length === 0 ? (
              <Chip tone="link">No fault codes</Chip>
            ) : (
              faults.map((f) => (
                <Chip key={f.field} tone="fault">
                  {f.part} · {f.field} {f.code}
                </Chip>
              ))
            )}
            {hot && <Chip tone="amber">Hot</Chip>}
          </div>
          <p className={cn('num font-mono text-xs', hot ? 'text-amber' : 'text-ink-2')}>
            {tempText('Hottest cell', ins.cellTempC)} · {tempText('MOS', ins.mosTempC)}
            <span className="text-ink-3">
              {' '}
              · alerts at {CELL_LIMIT} °C / {MOS_LIMIT} °C
            </span>
          </p>
          {charging && <p className="text-sm text-ink-2">{charging}</p>}

          <dl className="divide-y divide-hairline-soft rounded-lg border border-hairline-soft">
            {settingRows(ins.settings).map((r) => (
              <div key={r.label} className="px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-ink-2">{r.label}</dt>
                  <dd className={cn('num font-mono text-sm', r.warn ? 'text-amber' : 'text-ink')}>{r.value}</dd>
                </div>
                {(r.warn || r.note) && <p className={cn('mt-0.5 text-xs', r.warn ? 'text-amber' : 'text-ink-3')}>{r.warn ?? r.note}</p>}
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-3">Read-only: the Pi never changes the Delta. Change these in the EcoFlow app.</p>
        </>
      )}
      {own.map((pr) => (
        <p key={`${pr.code}-${pr.role ?? ''}`} className="text-sm text-amber">
          {pr.text}
        </p>
      ))}
    </Panel>
  );
}
