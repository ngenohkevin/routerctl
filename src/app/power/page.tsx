'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Panel } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { Stat, StatStrip } from '@/components/shell/stat';
import { PowerControls } from '@/components/power-controls';
import { PowerChart } from '@/components/power-chart';
import { OutageList } from '@/components/outage-list';
import { api, isAuthenticated } from '@/lib/api';
import { useUps } from '@/stores/ups';
import { alertText, powerHeadline, powerPanelTone, powerTone } from '@/lib/power';
import type { UPSHistory } from '@/types';

export default function PowerPage() {
  const router = useRouter();
  const { status: s, failed, loaded } = useUps();
  const [history, setHistory] = useState<UPSHistory | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  // Bumped after a control action so the new event shows straight away.
  const [reload, setReload] = useState(0);

  // History once on open, then every minute (the series moves a point per
  // minute). Errors are left to the status panel, which already says when
  // the agent can't be reached.
  useEffect(() => {
    let live = true;
    const load = () => {
      api
        .getUpsHistory()
        .then((h) => {
          if (live) setHistory(h);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [reload]);

  const live = !!s && s.available && !failed;
  const headline = loaded ? powerHeadline(s, failed) : 'Checking the UPS…';

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Power" description="The UPS that keeps the router, both ONTs and the Pi running through a power cut." />

        <Panel tone={powerPanelTone(s, failed)} className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Led tone={powerTone(s, failed)} className="size-2.5" label={headline} />
            <h2 className="text-[18px] font-semibold leading-6 text-ink">{headline}</h2>
          </div>
          {!live && loaded && (
            <p className="text-sm text-ink-2">
              {failed ? 'The dashboard can’t reach the agent on the Pi.' : s?.reason || 'USB unplugged or NUT down on the Pi.'}
            </p>
          )}
          {live &&
            (s.alerts ?? []).map((a) => (
              <p key={a} className="text-sm text-amber">
                {alertText(a)}
              </p>
            ))}
        </Panel>

        {live && (
          <StatStrip>
            <Stat
              label="Mains"
              value={s.state === 'online' ? `${Math.round(s.mains.voltage)} V` : 'Off'}
              hint={s.state === 'online' ? `${s.mains.frequency.toFixed(1)} Hz` : 'running on battery'}
              tone={s.state === 'online' ? 'ink' : 'amber'}
            />
            <Stat
              label="Battery"
              value={`${s.battery.voltage.toFixed(1)} V`}
              hint={`~${s.battery.charge}%${s.battery.chargeEstimated ? ' (estimated)' : ''}`}
              tone={s.state === 'low_battery' ? 'fault' : 'ink'}
            />
            <Stat label="Load" value={`${s.load}%`} hint="of the UPS's capacity" />
            <Stat
              label="Beeper"
              value={s.beeper === 'disabled' ? 'Muted' : 'On'}
              hint={s.beeper === 'disabled' ? 'silent during a cut' : 'beeps during a cut'}
            />
          </StatStrip>
        )}

        <PowerControls onChanged={() => setReload((n) => n + 1)} />
        <PowerChart series={history?.series ?? []} loading={!history} />
        <OutageList
          outages={history?.outages ?? []}
          events={history?.events ?? []}
          since={history?.since ?? null}
          loading={!history}
        />
      </div>
    </AppShell>
  );
}
