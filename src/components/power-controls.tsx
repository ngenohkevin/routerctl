'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUps, useUpsStore } from '@/stores/ups';
import type { UPSStatus } from '@/types';

/** Mute/unmute the beeper and run the quick self-test. Nothing here can cut power. */
export function PowerControls({ onChanged }: { onChanged: () => void }) {
  const { status: s, failed } = useUps();
  const setStatus = useUpsStore((st) => st.setStatus);
  const [busy, setBusy] = useState<'beeper' | 'test' | null>(null);

  const usable = !!s && s.available && !failed;
  const blocked = !usable
    ? 'The UPS isn’t reporting, so it can’t take commands.'
    : !s.controls.configured
      ? 'Controls aren’t set up on the Pi.'
      : null;
  const beeperOn = s?.beeper !== 'disabled';
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
          <div className="inline-flex rounded-lg border border-hairline bg-inset p-0.5" role="radiogroup" aria-label="UPS beeper">
            {([true, false] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={beeperOn === value}
                disabled={!!blocked || busy !== null}
                onClick={() =>
                  beeperOn !== value && run('beeper', () => api.setUpsBeeper(value), value ? 'Beeper on' : 'Beeper muted')
                }
                className={cn(
                  'flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 disabled:opacity-50',
                  beeperOn === value ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
                )}
              >
                {value ? 'On' : 'Muted'}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3">The UPS beeps the whole time it runs on battery. Mute it during a night cut.</p>
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
                disabled={!!blocked || busy !== null}
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
              disabled={!!blocked || !!testBlocked || busy !== null}
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
