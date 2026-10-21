'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { usePower } from '@/stores/power';
import type { PowerHistory } from '@/types';
import { PowerStatusPanel } from './status-panel';
import { PlugsPanel } from './plugs-panel';
import { PowerTimeline } from './power-timeline';
import { CutList } from './cut-list';
import { PowerSettingsPanel } from './settings-panel';

/** The Power page for the Delta and the two Tapo plugs. */
export function HomePowerView() {
  const { status: s, failed, loaded } = usePower();
  const [history, setHistory] = useState<PowerHistory | null>(null);
  const [reload, setReload] = useState(0);

  // History on open, every minute, and after an action.
  useEffect(() => {
    let live = true;
    const load = () => {
      api
        .getPowerHistory()
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

  const changed = () => setReload((n) => n + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Power"
        description="The Delta keeps the network and the TV group running in a power cut. The Pi reads the Delta over USB to tell when it’s on battery, and switches the TV group off when its time is up."
      />
      <PowerStatusPanel status={s} failed={failed} loaded={loaded} onChanged={changed} />
      <PlugsPanel plugs={s?.plugs ?? []} problems={s?.problems ?? []} inCut={!!s?.cut && !s.cut.test} loading={!loaded} />
      <PowerTimeline series={history?.series ?? []} loading={!history} />
      <CutList cuts={history?.cuts ?? []} events={history?.events ?? []} since={history?.since ?? null} loading={!history} />
      <PowerSettingsPanel status={s} onChanged={changed} />
    </div>
  );
}
