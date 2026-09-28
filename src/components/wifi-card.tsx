'use client';

import { Radar, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { timeAgo } from '@/components/device-detail-dialog';
import type { Device, WiFiRadio, WiFiEvent } from '@/types';

/** Signal quality in plain words, from dBm. */
function signalGrade(dbm?: number): { label: string; tone: 'link' | 'amber' | 'fault' | 'off'; bars: number } {
  if (dbm === undefined || dbm === null || Number.isNaN(dbm)) return { label: '—', tone: 'off', bars: 0 };
  if (dbm >= -55) return { label: 'excellent', tone: 'link', bars: 4 };
  if (dbm >= -65) return { label: 'good', tone: 'link', bars: 3 };
  if (dbm >= -72) return { label: 'weak', tone: 'amber', bars: 2 };
  return { label: 'poor', tone: 'fault', bars: 1 };
}

function Bars({ n, tone }: { n: number; tone: 'link' | 'amber' | 'fault' | 'off' }) {
  const fill = tone === 'link' ? 'bg-link' : tone === 'amber' ? 'bg-amber' : tone === 'fault' ? 'bg-fault' : 'bg-ink-4';
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cn('w-[3px] rounded-[1px]', i <= n ? fill : 'bg-hairline-strong')} style={{ height: `${i * 25}%` }} />
      ))}
    </span>
  );
}

const EVENT_TONE: Record<WiFiEvent['kind'], string> = {
  radar: 'text-fault',
  down: 'text-fault',
  channel: 'text-amber',
  up: 'text-link',
};

function deviceName(d: Device) {
  return d.comment || d.hostname || d.deviceModel || d.vendor || d.ip;
}

function RadioBlock({ radio, clients }: { radio: WiFiRadio; clients: Device[] }) {
  const sorted = [...clients].sort((a, b) => (a.signalDbm ?? -100) - (b.signalDbm ?? -100));
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Led
              tone={radio.running ? 'air' : radio.disabled ? 'off' : 'fault'}
              label={`${radio.band} ${radio.running ? 'running' : 'not running'}`}
            />
            <span className="text-sm font-medium text-ink">{radio.band}</span>
            {radio.running && radio.dfs && (
              <span className="rounded border border-amber/40 px-1 text-[10px] font-medium leading-4 text-amber">DFS</span>
            )}
          </div>
          <div className="num mt-0.5 pl-4 font-mono text-xs text-ink-3">
            {radio.running
              ? [
                  radio.number ? `ch ${radio.number}` : null,
                  radio.widthMhz ? `${radio.widthMhz} MHz` : null,
                  radio.txPower ? `tx ${radio.txPower} dBm` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : radio.disabled
                ? 'disabled'
                : 'not running — clients cannot join this band'}
          </div>
        </div>
        <span className="num shrink-0 text-xs text-ink-3">
          {radio.clients} {radio.clients === 1 ? 'device' : 'devices'}
        </span>
      </div>
      {radio.running && radio.dfs && (
        <p className="rounded-md border border-amber/25 bg-amber/5 px-2.5 py-1.5 text-xs text-ink-2">
          On a radar-shared channel. If radar is detected the router must leave it at once and every device on{' '}
          {radio.band} drops for about a minute.
        </p>
      )}
      {sorted.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-lg border border-hairline-soft">
          {sorted.map((d) => {
            const g = signalGrade(d.signalDbm);
            return (
              <li key={d.mac} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{deviceName(d)}</span>
                <span className={cn('num shrink-0 font-mono text-xs', g.tone === 'amber' ? 'text-amber' : g.tone === 'fault' ? 'text-fault' : 'text-ink-3')}>
                  {d.signalDbm ? `${d.signalDbm} dBm` : '—'}
                </span>
                <span title={`Signal ${g.label}`} className="shrink-0">
                  <Bars n={g.bars} tone={g.tone} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Wi-Fi radios: each band's live channel (and whether radar can knock it off),
 * the devices on it by signal, and the radio history the agent records —
 * channel moves, radios stopping, radar hits.
 */
export function WiFiCard({
  radios,
  events,
  devices,
}: {
  radios: WiFiRadio[];
  events: WiFiEvent[];
  devices: Device[];
}) {
  if (radios.length === 0) return null;
  const ordered = [...radios].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
  const recent = events.slice(0, 5);

  return (
    <Panel>
      <PanelHeader title="Wi-Fi" icon={<Wifi />} aside={ordered[0]?.ssid ? <span className="font-mono">{ordered[0].ssid}</span> : null} />
      <div className="space-y-5">
        {ordered.map((r) => (
          <RadioBlock
            key={r.interface}
            radio={r}
            clients={devices.filter((d) => d.interface === r.interface && (d.status === 'bound' || d.status === 'dynamic'))}
          />
        ))}
      </div>
      <div className="mt-5 border-t border-hairline-soft pt-4">
        <div className="eyebrow mb-2 flex items-center gap-1.5">
          <Radar className="size-3.5" /> Radio history
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-ink-3">No channel changes or radar hits recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((e, i) => (
              <li key={`${e.time}-${i}`} className="flex gap-2 text-xs">
                <span className="num w-14 shrink-0 text-ink-4">{timeAgo(e.time) || '—'}</span>
                <span className={cn('min-w-0', EVENT_TONE[e.kind])}>
                  <span className="text-ink-2">{e.message}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
