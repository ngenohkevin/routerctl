'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, MonitorSmartphone, Search } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Panel } from '@/components/shell/panel';
import { Chip } from '@/components/shell/chip';
import { Led } from '@/components/shell/led';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeviceSheet } from '@/components/device-sheet';
import { DeviceGlyph } from '@/components/device-glyph';
import { timeAgo } from '@/components/device-detail-dialog';
import { useDevicesStore } from '@/stores/devices';
import { api, isAuthenticated } from '@/lib/api';
import { cn } from '@/lib/utils';
import { connectionLabel, displayName, identityLine, isOnline, policyChips } from '@/lib/device';
import type { Device } from '@/types';

type Filter = 'all' | 'online' | 'new' | 'offline' | 'blocked';

const lan = (d: Device) => !d.wanSide && d.interface !== 'WAN';

function matches(d: Device, q: string) {
  if (!q) return true;
  const hay = [displayName(d), d.hostname, d.ip, d.mac, d.vendor, d.deviceModel, d.owner, d.os, d.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

const byName = (a: Device, b: Device) => displayName(a).localeCompare(displayName(b));
const byLastSeen = (a: Device, b: Device) => (b.lastSeen || '').localeCompare(a.lastSeen || '');

function DeviceRow({ d, onOpen }: { d: Device; onOpen: () => void }) {
  const online = isOnline(d);
  const line = identityLine(d);
  const chips = policyChips(d);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-raised/50 focus-visible:bg-raised/50 focus-visible:outline-none md:px-5"
      >
        <span
          className={cn(
            'relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-inset',
            online ? 'text-ink-2' : 'text-ink-4'
          )}
        >
          <DeviceGlyph device={d} className="size-[18px]" />
          <Led tone={online ? 'link' : 'off'} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-panel" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-[15px] font-medium', online ? 'text-ink' : 'text-ink-2')}>{displayName(d)}</span>
            {d.isNew && <Chip tone="amber">New</Chip>}
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-3">
            {[line, d.owner && `${d.owner}'s`].filter(Boolean).join(' · ') || 'Not identified'}
          </div>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
              {chips.map((c) => (
                <Chip key={c.label} tone={c.tone}>{c.label}</Chip>
              ))}
            </div>
          )}
        </div>

        <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 md:flex">
          {chips.map((c) => (
            <Chip key={c.label} tone={c.tone}>{c.label}</Chip>
          ))}
        </div>

        <div className="w-24 shrink-0 text-right md:w-36">
          <div className={cn('num font-mono text-[13px]', online ? 'text-ink-2' : 'text-ink-4')}>{d.ip || '—'}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-4">
            {online ? connectionLabel(d) : `seen ${timeAgo(d.lastSeen) ?? '—'}`}
          </div>
        </div>
      </button>
    </li>
  );
}

function Group({ title, devices, onOpen }: { title: string; devices: Device[]; onOpen: (mac: string) => void }) {
  if (devices.length === 0) return null;
  return (
    <div>
      <div className="eyebrow flex items-center justify-between border-b border-hairline-soft bg-inset/40 px-4 py-1.5 md:px-5">
        <span>{title}</span>
        <span className="num">{devices.length}</span>
      </div>
      <ul className="divide-y divide-hairline-soft">
        {devices.map((d) => (
          <DeviceRow key={d.mac} d={d} onOpen={() => onOpen(d.mac)} />
        ))}
      </ul>
    </div>
  );
}

export default function DevicesPage() {
  const router = useRouter();
  const { devices, fetchDevices, subscribeToEvents, acknowledge, isLoading } = useDevicesStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openMac, setOpenMac] = useState<string | null>(null);
  const [defaultLimit, setDefaultLimit] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchDevices();
    api
      .getDefaultBandwidth()
      .then((c) => setDefaultLimit(c.enabled ? c.limit : null))
      .catch(() => {});
    return subscribeToEvents();
  }, [fetchDevices, subscribeToEvents]);

  const all = useMemo(() => devices.filter(lan), [devices]);
  const counts = {
    all: all.length,
    online: all.filter(isOnline).length,
    new: all.filter((d) => d.isNew).length,
    offline: all.filter((d) => !isOnline(d)).length,
    blocked: all.filter((d) => d.isBlocked).length,
  };

  const visible = all.filter((d) => matches(d, query.trim()));
  const pick = (f: Filter) =>
    visible.filter((d) =>
      f === 'online' ? isOnline(d) : f === 'offline' ? !isOnline(d) : f === 'new' ? d.isNew : f === 'blocked' ? d.isBlocked : true
    );

  const groups =
    filter === 'all'
      ? [
          { title: 'New — do you recognise these?', list: visible.filter((d) => d.isNew).sort(byLastSeen) },
          { title: 'Online', list: visible.filter((d) => !d.isNew && isOnline(d)).sort(byName) },
          { title: 'Offline', list: visible.filter((d) => !d.isNew && !isOnline(d)).sort(byLastSeen) },
        ]
      : [
          {
            title: { online: 'Online', new: 'New', offline: 'Offline', blocked: 'Blocked' }[filter],
            list: pick(filter).sort(filter === 'offline' || filter === 'new' ? byLastSeen : byName),
          },
        ];

  const filters: { key: Filter; label: string; hide?: boolean }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online' },
    { key: 'new', label: 'New', hide: counts.new === 0 },
    { key: 'offline', label: 'Offline' },
    { key: 'blocked', label: 'Blocked', hide: counts.blocked === 0 },
  ];

  const openDevice = devices.find((d) => d.mac === openMac) ?? null;
  const empty = groups.every((g) => g.list.length === 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Devices"
          description="Everything that has joined your network, remembered even after it leaves. Name it, correct it, and set what it's allowed."
          actions={
            counts.new > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber/35 text-amber hover:text-amber"
                onClick={() => acknowledge().then(() => toast.success('All marked as reviewed'))}
              >
                <CheckCheck className="size-4" />
                Mark {counts.new} new as reviewed
              </Button>
            ) : undefined
          }
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="inline-flex rounded-lg border border-hairline bg-inset p-0.5" role="tablist" aria-label="Filter devices">
              {filters
                .filter((f) => !f.hide || filter === f.key)
                .map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                      filter === f.key ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
                    )}
                  >
                    {f.label}
                    <span className={cn('num text-xs', f.key === 'new' ? 'text-amber' : f.key === 'blocked' ? 'text-fault' : 'text-ink-4')}>
                      {counts[f.key]}
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, IP, owner, model…"
              className="h-9 pl-9"
              aria-label="Search devices"
            />
          </div>
        </div>

        <Panel className="overflow-hidden p-0 md:p-0">
          {empty ? (
            <div className="m-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-strong py-12 text-sm text-ink-3">
              <MonitorSmartphone className="size-5 text-ink-4" />
              {isLoading && all.length === 0
                ? 'Loading devices…'
                : query.trim()
                  ? `No devices match "${query.trim()}"`
                  : 'Nothing here.'}
            </div>
          ) : (
            groups.map((g) => <Group key={g.title} title={g.title} devices={g.list} onOpen={setOpenMac} />)
          )}
        </Panel>

        <p className="text-xs text-ink-4">
          Names, limits and blocks follow each device even when it gets a new address. A device with a limit, an
          exemption or a block has its address reserved, so the router keeps enforcing it on its own.
        </p>
      </div>

      <DeviceSheet
        device={openDevice}
        open={openMac !== null}
        onOpenChange={(o) => !o && setOpenMac(null)}
        defaultLimit={defaultLimit}
      />
    </AppShell>
  );
}
