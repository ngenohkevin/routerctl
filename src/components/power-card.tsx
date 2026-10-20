'use client';

import Link from 'next/link';
import { BatteryCharging, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { useUps } from '@/stores/ups';
import { usePower, powerMode } from '@/stores/power';
import { homePowerHeadline, homePowerPanelTone, homePowerTone, tvLine } from '@/lib/home-power';
import { alertText, dayClock, formatDuration, powerHeadline, powerPanelTone, powerTone } from '@/lib/power';

/** Power at a glance, in the Overview side column. Tapping opens the Power page. */
export function PowerCard() {
  const power = usePower();
  return powerMode(power) === 'plugs' ? <PlugsPowerCard /> : <UpsPowerCard />;
}

function PlugsPowerCard() {
  const { status: s, failed, loaded } = usePower();
  const headline = loaded ? homePowerHeadline(s, failed) : 'Checking the power…';
  const tv = (s?.plugs ?? []).find((p) => p.role === 'tv');
  const detail = s?.cut
    ? tvLine(s.cut)
    : tv
      ? `TV group ${tv.on === null ? 'not answering' : tv.on ? 'on' : 'off'}`
      : null;
  const problem = (s?.problems ?? [])[0];
  return (
    <Link
      href="/power"
      aria-label={`Power: ${headline}. Open the Power page`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link/50"
    >
      <Panel tone={homePowerPanelTone(s, failed)} className="transition-colors duration-150 hover:bg-raised/40">
        <PanelHeader title="Power" icon={<BatteryCharging />} aside={<ChevronRight className="size-4 text-ink-4" />} />
        <div className="flex items-center gap-2">
          <Led tone={homePowerTone(s, failed)} label={headline} />
          <span className={cn('text-sm font-medium', s && !failed ? 'text-ink' : 'text-ink-3')}>{headline}</span>
        </div>
        {detail && <p className="num mt-1.5 pl-4 font-mono text-xs text-ink-2">{detail}</p>}
        {problem && <p className="mt-1 pl-4 text-xs text-amber">{problem.text}</p>}
      </Panel>
    </Link>
  );
}

/** The UPS at a glance, in the Overview side column. Tapping opens the Power page. */
function UpsPowerCard() {
  const { status: s, failed, loaded } = useUps();
  const live = !!s && s.available && !failed;
  const headline = loaded ? powerHeadline(s, failed) : 'Checking the UPS…';

  return (
    <Link
      href="/power"
      aria-label={`Power: ${headline}. Open the Power page`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link/50"
    >
      <Panel tone={powerPanelTone(s, failed)} className="transition-colors duration-150 hover:bg-raised/40">
        <PanelHeader title="Power" icon={<BatteryCharging />} aside={<ChevronRight className="size-4 text-ink-4" />} />
        <div className="flex items-center gap-2">
          <Led tone={powerTone(s, failed)} label={headline} />
          <span className={cn('text-sm font-medium', live ? 'text-ink' : 'text-ink-3')}>{headline}</span>
        </div>

        {live && s && (
          <>
            <p className="num mt-1.5 pl-4 font-mono text-xs text-ink-2">
              Battery {s.battery.voltage.toFixed(1)} V{s.battery.state === 'charging' ? ' (charging)' : ''} · Load {s.load}% ·{' '}
              {s.state === 'online' ? `${Math.round(s.mains.voltage)} V` : 'mains off'}
            </p>
            {(s.alerts ?? []).map((a) => (
              <p key={a} className="mt-1 pl-4 text-xs text-amber">
                {alertText(a)}
              </p>
            ))}
            <p className="mt-1 pl-4 text-xs text-ink-3">
              {s.lastOutage
                ? `Last cut ${dayClock(s.lastOutage.start)} · ${formatDuration(s.lastOutage.durationSec)}${
                    s.lastOutage.ranOut ? ' · battery ran out' : ''
                  }`
                : 'No power cuts recorded yet'}
            </p>
          </>
        )}

        {!live && loaded && (
          <p className="mt-1.5 pl-4 text-xs text-ink-3">
            {failed ? 'The dashboard can’t reach the agent on the Pi.' : s?.reason || 'USB unplugged or NUT down on the Pi.'}
          </p>
        )}
      </Panel>
    </Link>
  );
}
