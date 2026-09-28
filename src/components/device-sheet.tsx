'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Ban, Check, Gauge, Pin, Power, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { BandwidthDialog } from '@/components/bandwidth-dialog';
import { DeviceGlyph } from '@/components/device-glyph';
import { PriorityDialog } from '@/components/priority-dialog';
import { Chip } from '@/components/shell/chip';
import { Led } from '@/components/shell/led';
import { timeAgo } from '@/components/device-detail-dialog';
import { useDevicesStore } from '@/stores/devices';
import { api } from '@/lib/api';
import { cn, formatBandwidth, formatDuration } from '@/lib/utils';
import {
  DEVICE_TYPES,
  IDENTIFIED_BY,
  connectionLabel,
  displayName,
  identityLine,
  isOnline,
  typeLabel,
} from '@/lib/device';
import type { Device } from '@/types';

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-hairline-soft px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right text-ink-2', mono && 'num font-mono text-[13px]')}>{children}</dd>
    </div>
  );
}

/** The owner's saved profile; type/model are set only when they override detection. */
function savedProfile(d: Device) {
  return {
    name: d.name ?? '',
    owner: d.owner ?? '',
    type: d.detectedType !== undefined ? d.deviceType ?? '' : '',
    model: d.detectedModel !== undefined ? d.deviceModel ?? '' : '',
    notes: d.notes ?? '',
  };
}

function when(iso?: string) {
  if (!iso || iso.startsWith('0001-')) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${timeAgo(iso)}`;
}

interface DeviceSheetProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Router-wide default per-device limit ("3M"), shown as the default option. */
  defaultLimit?: string | null;
}

/**
 * One device, managed in full: who it is (and how we know), where it sits on
 * the network, and what it's allowed to do. Its name, corrections, limits and
 * block follow it by MAC, so they survive it changing address.
 */
export function DeviceSheet({ device, open, onOpenChange, defaultLimit }: DeviceSheetProps) {
  const store = useDevicesStore();
  const [form, setForm] = useState({ name: '', owner: '', type: '', model: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [bandwidthOpen, setBandwidthOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'disconnect' | 'forget' | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the form when a different device opens (not on every live update).
  const mac = device?.mac;
  useEffect(() => {
    if (!device) return;
    setForm(savedProfile(device));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mac]);

  if (!device) return null;

  const online = isOnline(device);
  const name = displayName(device);
  const detectedType = device.detectedType ?? device.deviceType;
  const detectedModel = device.detectedModel ?? device.deviceModel;
  const remembered = !!device.remembered;
  const manageable = !remembered && !!device.ip;

  const saved = savedProfile(device);
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k].trim() !== saved[k]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await store.updateProfile(device.mac, {
        name: form.name.trim(),
        owner: form.owner.trim(),
        type: form.type,
        model: form.model.trim(),
        notes: form.notes.trim(),
      });
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const limitMode: 'default' | 'none' | 'custom' = device.isExempt
    ? 'none'
    : device.hasBWLimit && !device.isDefaultLimit && device.policy?.mode === 'limit'
      ? 'custom'
      : 'default';
  const defaultText = defaultLimit ? `${formatBandwidth(defaultLimit)} each way` : 'the house default';

  const statusLine = online
    ? [connectionLabel(device), device.ip, device.uptimeSeconds > 0 && `on for ${formatDuration(device.uptimeSeconds)}`]
        .filter(Boolean)
        .join(' · ')
    : `Offline · last seen ${timeAgo(device.lastSeen) ?? 'a while ago'}`;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto border-hairline bg-panel p-0 sm:max-w-md"
          // Don't focus the name field on open: on a phone that raises the
          // keyboard over the sheet before anything is read.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="gap-3 px-5 pt-5 pb-4 text-left">
            <div className="flex items-start gap-3 pr-8">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-inset text-ink-2">
                <DeviceGlyph device={device} className="size-5" />
                <Led tone={online ? 'link' : 'off'} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-panel" label={online ? 'Online' : 'Offline'} />
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg font-semibold tracking-[-0.01em] text-ink">{name}</SheetTitle>
                <SheetDescription className="mt-0.5 text-[13px] text-ink-3">{statusLine}</SheetDescription>
              </div>
            </div>
            {device.isNew && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber/35 bg-amber/5 px-3 py-2.5">
                <p className="text-[13px] text-ink-2">
                  New on your network{device.firstSeen ? ` · joined ${timeAgo(device.firstSeen)}` : ''}. Recognise it?
                </p>
                <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 border-hairline-strong" onClick={() => run(() => store.acknowledge(device.mac), 'Marked as reviewed')}>
                  <Check className="size-3.5" />
                  It&apos;s ours
                </Button>
              </div>
            )}
          </SheetHeader>

          {/* Identity */}
          <Section title="What it is">
            <div className="mb-4 rounded-lg border border-hairline-soft bg-inset/60 px-3 py-2.5">
              <div className="text-sm text-ink">{identityLine({ ...device, name: undefined }) || 'Not identified'}</div>
              <div className="mt-0.5 text-xs text-ink-3">
                {device.identifiedBy ? IDENTIFIED_BY[device.identifiedBy] : 'Nothing it sends says what it is'}
                {device.randomMac && ' · uses a private Wi-Fi address, so its maker is hidden'}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="dev-name" className="text-xs text-ink-3">Name</Label>
                <Input id="dev-name" autoComplete="off" value={form.name} maxLength={64} placeholder={displayName({ ...device, name: undefined })}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-ink-3">Type</Label>
                  <Select value={form.type || 'auto'} onValueChange={(v) => setForm({ ...form, type: v === 'auto' ? '' : v })}>
                    <SelectTrigger className="w-full" aria-label="Device type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto{typeLabel(detectedType) ? ` (${typeLabel(detectedType)})` : ''}</SelectItem>
                      {DEVICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dev-owner" className="text-xs text-ink-3">Belongs to</Label>
                  <Input id="dev-owner" autoComplete="off" value={form.owner} maxLength={64} placeholder="Who uses it"
                    onChange={(e) => setForm({ ...form, owner: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dev-model" className="text-xs text-ink-3">Model</Label>
                <Input id="dev-model" autoComplete="off" value={form.model} maxLength={64} placeholder={detectedModel || 'e.g. Galaxy A55'}
                  onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dev-notes" className="text-xs text-ink-3">Notes</Label>
                <textarea id="dev-notes" value={form.notes} maxLength={500} rows={2} placeholder="Anything worth remembering"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="min-h-[60px] w-full resize-y rounded-md border border-input bg-inset px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" />
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={!dirty || saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </Section>

          {/* Controls */}
          <Section title="Internet access">
            {!manageable ? (
              <p className="text-sm text-ink-3">
                It isn&apos;t on the network, so its speed and access can&apos;t be changed right now.
                {device.policy && (device.policy.mode || device.policy.blocked) && ' Its settings are kept and come back with it.'}
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm text-ink-2">Speed</div>
                  <div className="grid grid-cols-3 rounded-md border border-hairline bg-inset p-0.5" role="radiogroup" aria-label="Speed limit">
                    {([
                      ['default', 'Default'],
                      ['none', 'No limit'],
                      ['custom', 'Custom'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={limitMode === value}
                        disabled={busy || device.isBlocked}
                        onClick={() => {
                          if (value === 'custom') return setBandwidthOpen(true);
                          if (value === limitMode) return;
                          if (value === 'none') return run(() => store.exemptDevice(device.mac), 'No limit — full speed');
                          return run(
                            () => (limitMode === 'none' ? store.removeExemption(device.mac) : store.removeBandwidthLimit(device.mac)),
                            'Back on the default limit'
                          );
                        }}
                        className={cn(
                          'h-8 rounded-[5px] text-xs font-medium transition-colors duration-150 disabled:opacity-50',
                          limitMode === value ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">
                    {limitMode === 'none'
                      ? 'Full line speed, whatever the default.'
                      : limitMode === 'custom'
                        ? `Capped at ${formatBandwidth(device.policy?.download || device.downloadLimit || '0')} down, ${formatBandwidth(device.policy?.upload || device.uploadLimit || '0')} up.`
                        : `Shares the default: ${defaultText}. New devices start here.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 border-hairline-strong" disabled={busy || device.isBlocked} onClick={() => setPriorityOpen(true)}>
                    <Zap className="size-3.5" />
                    {device.priority && device.priority < 8 ? `Priority ${device.priority}` : 'Prioritise'}
                  </Button>
                  {device.isBlocked ? (
                    <Button variant="outline" size="sm" className="gap-1.5 border-hairline-strong" disabled={busy}
                      onClick={() => run(() => store.unblockDevice(device.mac), 'Unblocked')}>
                      <ShieldCheck className="size-3.5" />
                      Unblock
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 border-fault/35 text-fault hover:text-fault" disabled={busy}
                      onClick={() => setConfirm('block')}>
                      <Ban className="size-3.5" />
                      Block
                    </Button>
                  )}
                  {online && connectionLabel(device) !== 'Wired' && (
                    <Button variant="outline" size="sm" className="gap-1.5 border-hairline-strong" disabled={busy} onClick={() => setConfirm('disconnect')}>
                      <Power className="size-3.5" />
                      Disconnect
                    </Button>
                  )}
                </div>

                {device.isBlocked && (
                  <p className="text-xs text-fault">Blocked: no internet for this device. The block follows it if its address changes.</p>
                )}
              </div>
            )}
          </Section>

          {/* Network */}
          <Section
            title="On the network"
            aside={
              manageable && !device.reserved && device.status === 'bound' ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-ink-3" disabled={busy}
                  onClick={() => run(async () => { await api.reserveLease(device.mac); await store.fetchDevices(); }, 'Address reserved')}>
                  <Pin className="size-3.5" />
                  Reserve address
                </Button>
              ) : null
            }
          >
            <dl className="divide-y divide-hairline-soft">
              <Fact label="IP address" mono>
                {device.ip ? (
                  <span className="inline-flex items-center gap-2">
                    {device.ip}
                    {device.reserved && <Chip className="h-5 px-1.5 text-[10px]">Reserved</Chip>}
                  </span>
                ) : null}
              </Fact>
              <Fact label="MAC" mono>{device.mac}{device.randomMac ? ' · private' : ''}</Fact>
              <Fact label="Calls itself" mono>{device.hostname}</Fact>
              <Fact label="Connection">{online ? connectionLabel(device) : null}</Fact>
              <Fact label="Signal" mono>{online && device.signalDbm ? `${device.signalDbm} dBm` : null}</Fact>
              <Fact label="First seen">{when(device.firstSeen)}</Fact>
              <Fact label="Last seen">{online ? 'Now' : when(device.lastSeen)}</Fact>
              <Fact label="Transferred" mono>
                {device.bytesIn || device.bytesOut
                  ? `↓ ${formatBytes(device.bytesIn)} · ↑ ${formatBytes(device.bytesOut)}`
                  : null}
              </Fact>
            </dl>
            {device.priority && device.priority < 8 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                <Gauge className="size-3.5" /> Its traffic goes ahead of others when the line is busy.
              </p>
            ) : null}
          </Section>

          {(remembered || !online) && (
            <div className="border-t border-hairline-soft px-5 py-4">
              <Button variant="ghost" size="sm" className="gap-1.5 text-ink-3 hover:text-fault" disabled={busy}
                onClick={() => setConfirm('forget')}>
                <Trash2 className="size-3.5" />
                Forget this device
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <BandwidthDialog
        device={device}
        open={bandwidthOpen}
        onOpenChange={setBandwidthOpen}
        onSetLimit={async (m, up, down) => {
          await store.setBandwidthLimit(m, up, down);
          toast.success('Limit set');
          setBandwidthOpen(false);
        }}
        onRemoveLimit={async (m) => {
          await store.removeBandwidthLimit(m);
          toast.success('Limit removed');
          setBandwidthOpen(false);
        }}
      />
      <PriorityDialog
        device={device}
        open={priorityOpen}
        onOpenChange={setPriorityOpen}
        onSetPriority={async (p) => {
          await store.setDevicePriority(device.mac, p);
          toast.success('Priority set');
          setPriorityOpen(false);
        }}
        onRemovePriority={async () => {
          await store.removeDevicePriority(device.mac);
          toast.success('Priority removed');
          setPriorityOpen(false);
        }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'block' ? `Block ${name}?` : confirm === 'disconnect' ? `Disconnect ${name}?` : `Forget ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'block'
                ? 'It loses internet access until you unblock it, even if it gets a new address.'
                : confirm === 'disconnect'
                  ? 'It is dropped from Wi-Fi. Most devices reconnect on their own within seconds.'
                  : 'Its name, notes and history are removed. If it joins again it shows up as a new device.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm !== 'disconnect' ? 'bg-fault text-white hover:bg-fault/90' : undefined}
              onClick={() => {
                const which = confirm;
                setConfirm(null);
                if (which === 'block') run(() => store.blockDevice(device.mac), 'Blocked');
                if (which === 'disconnect') run(() => store.disconnectDevice(device.mac), 'Disconnected');
                if (which === 'forget')
                  run(async () => {
                    await store.forgetDevice(device.mac);
                    onOpenChange(false);
                  }, 'Forgotten');
              }}
            >
              {confirm === 'block' ? 'Block' : confirm === 'disconnect' ? 'Disconnect' : 'Forget'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatBytes(v?: string): string {
  const n = parseInt(v || '0', 10);
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}
