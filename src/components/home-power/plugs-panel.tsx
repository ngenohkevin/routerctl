'use client';

import { Plug } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { Chip } from '@/components/shell/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { dayClock } from '@/lib/power';
import { signalText } from '@/lib/home-power';
import type { PowerPlug, PowerProblem } from '@/types';

const WHERE: Record<string, string> = { tv: 'on the Delta: TV, soundbar, Mi Box', mains: 'wall socket, feeds the Delta' };

export function PlugsPanel({
  plugs,
  problems,
  inCut,
  loading,
}: {
  plugs: PowerPlug[];
  problems: PowerProblem[];
  inCut: boolean;
  loading: boolean;
}) {
  return (
    <Panel className="space-y-3">
      <PanelHeader title="Plugs" icon={<Plug />} />
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ul className="divide-y divide-hairline">
          {plugs.map((p) => {
            const noPower = p.role === 'mains' && !p.reachable && inCut;
            const facts = [
              p.ip || 'no address',
              p.on === null ? 'relay unknown' : p.on ? 'on' : 'off',
              p.rssi ? `${p.rssi} dBm, ${signalText(p.rssi)}` : null,
              p.firmware ? `firmware ${p.firmware.split(' ')[0]}` : null,
            ].filter(Boolean);
            return (
              <li key={p.role} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Led tone={p.reachable ? 'link' : noPower ? 'amber' : 'fault'} label={p.reachable ? 'answering' : 'not answering'} />
                    <span className="text-sm font-medium text-ink">{p.name}</span>
                    <span className="text-xs text-ink-3">{WHERE[p.role]}</span>
                  </div>
                  <p className="num mt-0.5 pl-4 font-mono text-xs text-ink-2">{facts.join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.internetBlocked === true && <Chip tone="link">Internet blocked</Chip>}
                  {p.internetBlocked === false && <Chip tone="amber">Has internet</Chip>}
                  {noPower && <Chip tone="amber">No power</Chip>}
                  {!p.reachable && !noPower && (
                    <Chip tone="fault">Not answering{p.lastSeen ? ` since ${dayClock(p.lastSeen)}` : ''}</Chip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {problems.map((pr) => (
        <p key={`${pr.code}-${pr.role ?? ''}`} className="text-sm text-amber">
          {pr.text}
        </p>
      ))}
    </Panel>
  );
}
