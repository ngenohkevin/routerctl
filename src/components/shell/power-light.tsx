'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Led } from '@/components/shell/led';
import { homePowerTone } from '@/lib/home-power';
import { powerMode, usePower } from '@/stores/power';
import type { PowerStatus } from '@/types';

/** The power at a glance: "Mains on · 100%", "On battery · 97%", "Test cut · 99%". */
export function powerLightText(s: PowerStatus | null, failed: boolean): string {
  if (failed || !s) return 'Power: no data';
  const d = s.delta?.available ? s.delta : null;
  const pct = d?.charge != null ? ` · ${d.charge}%` : '';
  if (s.test) return `Test cut${pct}`;
  if (s.guardWaiting) return `Power back · reconnecting${pct}`;
  if ((s.cut && !s.cut.test) || d?.state === 'on_battery') return `On battery${pct}`;
  if (!d && s.mains === 'unknown') return 'Power: can’t tell';
  if (d?.state === 'charging') return `Charging${pct}`;
  return `Mains on${pct}`;
}

/** On every page (sidebar footer, phone top bar); tapping opens the Power page. */
export function PowerLight({ className, textClassName }: { className?: string; textClassName?: string }) {
  const power = usePower(15_000);
  if (powerMode(power) !== 'plugs') return null; // an older agent, or no plugs set up
  const { status: s, failed } = power;
  const text = powerLightText(s, failed);
  return (
    <Link
      href="/power"
      title={text}
      aria-label={`Power: ${text}. Open the Power page`}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md text-xs text-ink-3 transition-colors hover:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link/50',
        className
      )}
    >
      <Led tone={homePowerTone(s, failed)} label={text} />
      <span className={cn('num truncate', textClassName)}>{text}</span>
    </Link>
  );
}
