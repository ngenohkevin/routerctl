'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { clock } from '@/lib/power';
import {
  deltaLine,
  deltaOnBattery,
  homePowerHeadline,
  homePowerPanelTone,
  homePowerTone,
  runtimeLine,
  tvLine,
  tvStateText,
  warningNote,
} from '@/lib/home-power';
import { useNow } from '@/lib/use-now';
import { usePowerStore } from '@/stores/power';
import { TOUCH } from './touch';
import type { PowerStatus } from '@/types';

/** The headline, the countdown and its buttons, the TV Group switch, and a running test. */
export function PowerStatusPanel({
  status: s,
  failed,
  loaded,
  onChanged,
}: {
  status: PowerStatus | null;
  failed: boolean;
  loaded: boolean;
  onChanged: () => void;
}) {
  const now = useNow(1000);
  const setStatus = usePowerStore((st) => st.setStatus);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, call: () => Promise<PowerStatus>, done: string) {
    setBusy(key);
    try {
      setStatus(await call());
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The Pi didn’t take that');
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  const headline = loaded ? homePowerHeadline(s, failed, now) : 'Checking the power…';
  const cut = s?.cut ?? null;
  const runtime = failed ? null : runtimeLine(s, now);
  const held = failed ? null : warningNote(s);
  const tv = (s?.plugs ?? []).find((p) => p.role === 'tv');

  return (
    <Panel tone={homePowerPanelTone(s, failed)} className="space-y-3">
      <div className="flex items-center gap-2.5">
        <Led tone={homePowerTone(s, failed)} className="size-2.5" label={headline} />
        <h2 className="text-[18px] font-semibold leading-6 text-ink">{headline}</h2>
      </div>
      {failed && <p className="text-sm text-ink-2">The dashboard can’t reach the agent on the Pi.</p>}
      {!failed && s?.delta && (
        <p className={cn('num font-mono text-xs', s.delta.available ? 'text-ink-2' : 'text-ink-3')}>
          Delta · {deltaLine(s.delta) ?? `no reading over USB${s.delta.error ? ` (${s.delta.error})` : ''}`}
        </p>
      )}
      {!failed && s?.delta && (
        <p className="text-xs text-ink-3">
          {s.test
            ? 'During a test the plugs decide: the Delta is meant to be on battery.'
            : s.delta.available
              ? 'Power cuts are detected by the Delta.'
              : 'Power cuts are detected by the plugs while the Delta can’t be read; a power-guard cut would go unnoticed.'}
        </p>
      )}
      {runtime && !cut && <p className="text-xs text-ink-3">{runtime}</p>}
      {!failed && s && !s.cut && !s.test && s.guardWaiting && (
        <p className="text-sm text-ink-2">
          Power is back. The power guard waits about 40 seconds for a steady voltage before passing it to the Delta.
        </p>
      )}
      {!failed && s && !s.cut && !s.test && !s.guardWaiting && deltaOnBattery(s.delta) && (
        <p className="text-sm text-ink-2">
          The Delta is on battery. The Pi confirms a power cut after 15 seconds.
        </p>
      )}
      {!failed && s?.reason && <p className="text-sm text-ink-2">{s.reason}</p>}
      {!failed && cut && !cut.test && cut.cause === 'supply' && (
        <p className="text-sm text-ink-2">
          The house has power, but the Delta isn’t getting it. Check the power guard’s lights and the Delta’s charging cable.
        </p>
      )}

      {cut && (
        <div className="space-y-2.5">
          <p className="num text-sm text-ink">
            {tvLine(cut, now)}
            {cut.mainsBackSince ? ` · power back since ${clock(cut.mainsBackSince)}, confirming (15 s)` : ''}
          </p>
          {held && <p className="text-sm text-ink-2">{held}</p>}
          {runtime && <p className="num text-sm text-ink-2">{runtime}</p>}
          <div className="flex flex-wrap gap-2">
            {cut.mode === 'off' ? (
              <Button
                size="sm"
                className={TOUCH}
                disabled={!!busy}
                onClick={() => run('on', () => api.setPowerTV(true), `TV group on for ${cut.cutoffMinutes} minutes`)}
              >
                On for another {cut.cutoffMinutes} min
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className={TOUCH} disabled={!!busy} onClick={() => run('p10', () => api.extendPowerCut({ minutes: 10 }), 'Ten more minutes')}>
                  +10 min
                </Button>
                <Button size="sm" variant="outline" className={TOUCH} disabled={!!busy} onClick={() => run('p30', () => api.extendPowerCut({ minutes: 30 }), 'Thirty more minutes')}>
                  +30 min
                </Button>
                {cut.mode !== 'until_power' && (
                  <Button size="sm" variant="outline" className={TOUCH} disabled={!!busy} onClick={() => run('until', () => api.extendPowerCut({ until: 'power' }), 'TV group stays on until power returns')}>
                    Until power returns
                  </Button>
                )}
                <Button size="sm" variant="destructive" className={TOUCH} disabled={!!busy} onClick={() => run('off', () => api.extendPowerCut({ off: true }), 'TV group off')}>
                  Off now
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {!cut && tv && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-2">{tvStateText(s, tv.on)}</span>
          <Switch
            checked={!!tv.on}
            disabled={!!busy || tv.on === null}
            onCheckedChange={(v) => run('tv', () => api.setPowerTV(v), v ? 'TV group on' : 'TV group off')}
            aria-label="TV group power"
            // The switch stays small; on touch an invisible 44px pad around it takes the tap.
            className="relative pointer-coarse:after:absolute pointer-coarse:after:-inset-[13px]"
          />
        </div>
      )}

      {s?.test && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber/35 px-3 py-2">
          <span className="text-sm text-ink">
            Test cut: Mains is off until {clock(s.test.ends)} (cutoff {s.test.cutoffMinutes} min).
          </span>
          <Button size="sm" variant="outline" className={TOUCH} disabled={!!busy} onClick={() => run('stop', () => api.stopPowerTest(), 'Test stopped, Mains back on')}>
            Stop
          </Button>
        </div>
      )}

      {s?.configured && !s.alertsConfigured && (
        <p className="text-xs text-amber">
          Alerts aren’t set up on the Pi (~/.config/routerctl-agent/alerts.env), so nothing reaches Telegram or Kuma.
        </p>
      )}
    </Panel>
  );
}
