'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { api } from '@/lib/api';
import { usePowerStore } from '@/stores/power';
import type { PowerStatus } from '@/types';

export function PowerSettingsPanel({ status: s, onChanged }: { status: PowerStatus | null; onChanged: () => void }) {
  const setStatus = usePowerStore((st) => st.setStatus);
  const [cutoff, setCutoff] = useState('20');
  const [quietStart, setQuietStart] = useState('23:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<5 | 15 | 30>(5);
  const [quick, setQuick] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fill the form once from the agent's settings (not on every poll, or it would undo typing).
  useEffect(() => {
    if (!s || loadedFrom) return;
    setCutoff(String(s.settings.cutoffMinutes));
    setQuietStart(s.settings.quietStart);
    setQuietEnd(s.settings.quietEnd);
    setLoadedFrom(s.updatedAt ?? 'loaded');
  }, [s, loadedFrom]);

  async function save() {
    setBusy(true);
    try {
      setStatus(await api.updatePowerSettings({ cutoffMinutes: Number(cutoff), quietStart, quietEnd }));
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Not saved');
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function startTest() {
    setBusy(true);
    try {
      setStatus(await api.startPowerTest(minutes, quick ? 2 : undefined));
      toast.success(`Test cut started: Mains off for ${minutes} minutes`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The test didn’t start');
    } finally {
      setBusy(false);
      setConfirming(false);
      onChanged();
    }
  }

  const testBlocked = s?.cut ? 'Not during a power cut.' : s?.test ? 'A test is already running.' : null;

  return (
    <Panel className="space-y-5">
      <PanelHeader title="Settings" icon={<SlidersHorizontal />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="power-cutoff">TV group cutoff (minutes)</Label>
          <Input id="power-cutoff" type="number" min={1} max={180} value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="power-quiet-start">Quiet from</Label>
          <Input id="power-quiet-start" type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="power-quiet-end">Quiet until</Label>
          <Input id="power-quiet-end" type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-ink-3">
        Each cut starts from the cutoff; extensions apply to that cut only. In quiet hours the Pi’s messages arrive silently;
        Kuma’s power-cut alert still sounds.
      </p>
      <Button size="sm" onClick={save} disabled={busy}>
        Save settings
      </Button>

      <div className="space-y-3 border-t border-hairline pt-4">
        <h3 className="text-sm font-medium text-ink">Test a power cut</h3>
        <p className="text-xs text-ink-2">
          The Pi switches Mains off, so the Delta runs on battery as in a real cut, and the whole switch-off runs. Messages
          start with “Test:” and Kuma doesn’t go down. To test detection itself, pull Mains out of the wall instead.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="power-test-length" className="text-sm">
            Length
          </Label>
          <select
            id="power-test-length"
            className="h-8 rounded-md border border-hairline bg-transparent px-2 text-sm text-ink"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) as 5 | 15 | 30)}
          >
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
          <label htmlFor="power-test-quick" className="flex items-center gap-2 text-sm text-ink-2">
            <input id="power-test-quick" type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
            2-minute cutoff for this test
          </label>
          <Button size="sm" variant="outline" disabled={busy || !!testBlocked} onClick={() => setConfirming(true)}>
            Test a power cut
          </Button>
        </div>
        {testBlocked && <p className="text-xs text-ink-3">{testBlocked}</p>}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Mains off for {minutes} minutes?</AlertDialogTitle>
            <AlertDialogDescription>
              The Delta will run on battery and TV Group switches off after {quick ? 2 : s?.settings.cutoffMinutes ?? 20} minutes.
              The Pi can’t see the Delta’s battery yet, so check it’s well charged first. Mains comes back on by itself when the
              test ends, or when you press Stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startTest} disabled={busy}>
              Start the test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
