'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { api } from '@/lib/api';
import { useUps, useUpsStore } from '@/stores/ups';
import type { UPSStatus } from '@/types';

/** Toggle the beeper during a cut and run the quick self-test. Nothing here can cut power. */
export function PowerControls({ onChanged }: { onChanged: () => void }) {
  const { status: s, failed, loaded } = useUps();
  const setStatus = useUpsStore((st) => st.setStatus);
  const [busy, setBusy] = useState<'beeper' | 'test' | null>(null);

  const usable = !!s && s.available && !failed;
  const canCommand = loaded && usable && s.controls.configured;
  // Why the buttons are off. Nothing while the first reading loads.
  const blocked = !loaded
    ? null
    : !usable
      ? 'The UPS isn’t reporting, so it can’t take commands.'
      : !s.controls.configured
        ? 'Controls aren’t set up on the Pi.'
        : null;
  const onBattery = usable && (s.state === 'on_battery' || s.state === 'low_battery');
  const testBlocked = usable && s.state !== 'online' ? 'Only on mains: the test runs the UPS on battery for about 10 seconds.' : null;

  async function run(kind: 'beeper' | 'test', call: () => Promise<UPSStatus>, done: string) {
    setBusy(kind);
    try {
      setStatus(await call());
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The UPS didn’t take the command');
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  return (
    <Panel>
      <PanelHeader title="Controls" icon={<SlidersHorizontal />} />
      {blocked && <p className="mb-3 text-sm text-ink-3">{blocked}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="eyebrow">Beeper</div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!canCommand || !onBattery || busy !== null}
            onClick={() => run('beeper', () => api.toggleUpsBeeper(), 'Beeper toggled')}
          >
            Toggle beeper
          </Button>
          <p className="text-xs text-ink-3">
            {onBattery
              ? 'Silences the beeping during a cut. This UPS can’t report its beeper, so if it keeps beeping, tap again (wait a few seconds between taps).'
              : 'Works while it’s beeping on battery. If a cut is ever silent, the mute stuck: tap once during that cut to turn it back on.'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="eyebrow">Battery self-test</div>
          {s?.testing ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink">Testing…</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!canCommand || busy !== null}
                onClick={() => run('test', () => api.upsTest('stop'), 'Self-test stopped')}
              >
                Stop
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!canCommand || !!testBlocked || busy !== null}
              onClick={() => run('test', () => api.upsTest('start'), 'Self-test requested')}
            >
              Run quick self-test
            </Button>
          )}
          <p className="text-xs text-ink-3">
            {testBlocked ?? 'Runs the UPS on battery for about 10 seconds. A weak battery shows up here before a real cut finds it.'}
          </p>
        </div>
      </div>
    </Panel>
  );
}
