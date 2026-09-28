'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Search, SearchX } from 'lucide-react';
import { isAuthenticated } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeviceCard } from '@/components/device-card';
import { DeviceDetailDialog } from '@/components/device-detail-dialog';
import { UplinksCard } from '@/components/uplinks-card';
import { SystemStatus } from '@/components/system-status';
import { WiFiCard } from '@/components/wifi-card';
import { NetworkPath } from '@/components/network-path';
import { AppShell } from '@/components/shell/app-shell';
import { BandwidthDialog } from '@/components/bandwidth-dialog';
import { RenameDialog } from '@/components/rename-dialog';
import { PriorityDialog } from '@/components/priority-dialog';
import { useDevicesStore } from '@/stores/devices';
import { useNetwork } from '@/stores/network';
import { toast } from 'sonner';
import type { Device } from '@/types';

type DeviceFilter = 'all' | 'wifi' | 'ethernet' | 'disconnected' | 'blocked';

export default function Dashboard() {
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const {
    devices,
    systemInfo,
    isLoading,
    error,
    lastUpdated,
    fetchDevices,
    fetchSystemInfo,
    fetchHealth,
    blockDevice,
    unblockDevice,
    setBandwidthLimit,
    removeBandwidthLimit,
    disconnectDevice,
    setDeviceName,
    setDevicePriority,
    removeDevicePriority,
    wakeOnLan,
    exemptDevice,
    removeExemption,
    subscribeToEvents,
  } = useDevicesStore();

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [bandwidthDialogOpen, setBandwidthDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ mac: string; currentName: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'ip' | 'usage'>('default');
  const [detailMac, setDetailMac] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const network = useNetwork();

  useEffect(() => {
    // Initial fetch
    fetchHealth();
    fetchDevices();
    fetchSystemInfo();

    // Subscribe to real-time updates via SSE
    const unsubscribe = subscribeToEvents();

    // Refresh health check periodically
    const healthInterval = setInterval(() => {
      fetchHealth();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(healthInterval);
    };
  }, [fetchHealth, fetchDevices, fetchSystemInfo, subscribeToEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchHealth(), fetchDevices(), fetchSystemInfo(), network.refresh()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSetBandwidth = (mac: string) => {
    const device = devices.find((d) => d.mac === mac);
    if (device) {
      setSelectedDevice(device);
      setBandwidthDialogOpen(true);
    }
  };

  const handleRename = (mac: string, currentName: string) => {
    setRenameTarget({ mac, currentName });
    setRenameDialogOpen(true);
  };

  const handleBoost = (mac: string) => {
    const device = devices.find((d) => d.mac === mac);
    if (device) {
      setSelectedDevice(device);
      setPriorityDialogOpen(true);
    }
  };

  const handleDisconnect = async (mac: string) => {
    try {
      await disconnectDevice(mac);
      toast.success('Device disconnected');
    } catch {
      toast.error('Failed to disconnect device');
    }
  };

  const handleWakeOnLan = async (mac: string) => {
    try {
      await wakeOnLan(mac);
      toast.success('Wake on LAN packet sent');
    } catch {
      toast.error('Failed to send Wake on LAN');
    }
  };

  const handleExempt = async (mac: string) => {
    try {
      await exemptDevice(mac);
      toast.success('Device exempted from default limit');
    } catch {
      toast.error('Failed to exempt device');
    }
  };

  const handleRemoveExemption = async (mac: string) => {
    try {
      await removeExemption(mac);
      toast.success('Exemption removed');
    } catch {
      toast.error('Failed to remove exemption');
    }
  };

  const handleSaveRename = async (name: string) => {
    if (!renameTarget) return;
    try {
      await setDeviceName(renameTarget.mac, name);
      toast.success('Device renamed');
      setRenameDialogOpen(false);
    } catch {
      toast.error('Failed to rename device');
    }
  };

  const handleSavePriority = async (priority: number) => {
    if (!selectedDevice) return;
    try {
      await setDevicePriority(selectedDevice.mac, priority);
      toast.success('Priority set');
      setPriorityDialogOpen(false);
    } catch {
      toast.error('Failed to set priority');
    }
  };

  const handleRemovePriority = async () => {
    if (!selectedDevice) return;
    try {
      await removeDevicePriority(selectedDevice.mac);
      toast.success('Priority removed');
      setPriorityDialogOpen(false);
    } catch {
      toast.error('Failed to remove priority');
    }
  };

  // Check if MAC uses randomized/private addressing (2nd hex digit is 2, 6, A, or E)
  const hasRandomizedMAC = (mac: string) => {
    if (mac.length < 2) return false;
    const ch = mac[1].toUpperCase();
    return ch === '2' || ch === '6' || ch === 'A' || ch === 'E';
  };

  // Helper to check if device is WiFi (has signal, is mobile type, or has randomized MAC)
  const mobileTypes = ['phone', 'tablet', 'mobile', 'watch', 'apple', 'android'];
  const isWifiDevice = (d: Device) =>
    !!d.signalStrength ||
    mobileTypes.includes(d.deviceType?.toLowerCase() || '') ||
    hasRandomizedMAC(d.mac);

  // Exclude WAN-side devices (ISP CPEs on any uplink — agent tags them)
  const lanDevices = devices.filter((d) => !d.wanSide && d.interface !== 'WAN');

  // Connected devices: 'bound' (connected with DHCP) or 'dynamic' (connected, ARP-only)
  const connectedDevices = lanDevices.filter((d) => d.status === 'bound' || d.status === 'dynamic');

  // Disconnected devices: 'offline' or other non-connected status
  const disconnectedDevices = lanDevices.filter((d) => d.status !== 'bound' && d.status !== 'dynamic');

  // WiFi devices (from connected only)
  const wifiDevices = connectedDevices.filter((d) => isWifiDevice(d));

  // Ethernet devices (from connected only)
  const ethernetDevices = connectedDevices.filter(
    (d) => !isWifiDevice(d) && d.interface && d.interface.length > 0
  );

  const blockedDevices = lanDevices.filter((d) => d.isBlocked);

  // Search + sort applied to every tab's list
  const displayNameOf = (d: Device) =>
    d.comment || d.hostname || d.deviceModel || d.vendor || d.ip;

  const matchesQuery = (d: Device) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [d.comment, d.hostname, d.deviceModel, d.vendor, d.ip, d.mac].some((f) =>
      f?.toLowerCase().includes(q)
    );
  };

  const ipKey = (ip: string) =>
    ip.split('.').map((o) => o.padStart(3, '0')).join('.');

  const usageOf = (d: Device) =>
    parseInt(d.bytesIn || '0', 10) + parseInt(d.bytesOut || '0', 10);

  const sortDevices = (list: Device[]) => {
    if (sortBy === 'default') return list;
    const sorted = [...list];
    if (sortBy === 'name') {
      sorted.sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
    } else if (sortBy === 'ip') {
      sorted.sort((a, b) => ipKey(a.ip).localeCompare(ipKey(b.ip)));
    } else if (sortBy === 'usage') {
      sorted.sort((a, b) => usageOf(b) - usageOf(a));
    }
    return sorted;
  };

  const detailDevice = detailMac ? devices.find((d) => d.mac === detailMac) || null : null;

  const renderDeviceGrid = (list: Device[], emptyMessage: string) => {
    const visible = sortDevices(list.filter(matchesQuery));
    if (visible.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-14 text-center text-ink-3">
          <SearchX className="mb-2 size-7 text-ink-4" />
          <p className="text-sm">
            {searchQuery.trim() ? `No devices match "${searchQuery.trim()}"` : emptyMessage}
          </p>
        </div>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {visible.map((device) => (
          <DeviceCard
            key={device.mac}
            device={device}
            onBlock={blockDevice}
            onUnblock={unblockDevice}
            onSetBandwidth={handleSetBandwidth}
            onDisconnect={handleDisconnect}
            onBoost={handleBoost}
            onRename={handleRename}
            onWakeOnLan={handleWakeOnLan}
            onExempt={handleExempt}
            onRemoveExemption={handleRemoveExemption}
            onShowDetails={setDetailMac}
          />
        ))}
      </div>
    );
  };

  const stats = {
    total: connectedDevices.length,
    wifi: wifiDevices.length,
    ethernet: ethernetDevices.length,
    blocked: blockedDevices.length,
    disconnected: disconnectedDevices.length,
  };

  const filters: { key: DeviceFilter; label: string; count: number; list: Device[]; empty: string; hideWhenZero?: boolean }[] = [
    { key: 'all', label: 'Online', count: stats.total, list: connectedDevices, empty: 'No devices are connected right now' },
    { key: 'wifi', label: 'Wi-Fi', count: stats.wifi, list: wifiDevices, empty: 'No Wi-Fi devices are connected' },
    { key: 'ethernet', label: 'Wired', count: stats.ethernet, list: ethernetDevices, empty: 'No wired devices are connected' },
    { key: 'disconnected', label: 'Offline', count: stats.disconnected, list: disconnectedDevices, empty: 'No offline devices', hideWhenZero: true },
    { key: 'blocked', label: 'Blocked', count: stats.blocked, list: blockedDevices, empty: 'No blocked devices', hideWhenZero: true },
  ];
  const activeFilter = filters.find((f) => f.key === filter) ?? filters[0];

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8">
        {error && (
          <div className="rounded-xl border border-fault/40 bg-fault/5 px-4 py-3 text-sm text-ink-2">
            <span className="font-medium text-fault">Can’t reach the router agent.</span> {error}
          </div>
        )}

        <NetworkPath
          links={network.links}
          failover={network.failover}
          radios={network.wifi?.radios ?? []}
          wiredCount={stats.ethernet}
          systemInfo={systemInfo}
          loaded={network.loaded}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          {/* Devices */}
          <section aria-labelledby="devices-heading" className="min-w-0 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="devices-heading" className="text-lg font-semibold tracking-[-0.01em] text-ink">
                  Devices
                </h2>
                <p className="text-xs text-ink-3">
                  {stats.total} online
                  {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            {/* Filter — scrolls sideways on narrow phones rather than wrapping */}
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div role="tablist" aria-label="Device filter" className="inline-flex rounded-lg border border-hairline bg-inset p-0.5">
                {filters
                  .filter((f) => !f.hideWhenZero || f.count > 0 || f.key === filter)
                  .map((f) => {
                    const on = f.key === activeFilter.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                          'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
                          on ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2',
                          f.key === 'blocked' && f.count > 0 && !on && 'text-fault/80'
                        )}
                      >
                        {f.label}
                        <span className={cn('num font-mono text-[11px]', on ? 'text-ink-3' : 'text-ink-4')}>{f.count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                <Input
                  placeholder="Search devices"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 border-hairline bg-inset pl-9 md:h-9"
                  aria-label="Search devices"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-10 w-[120px] shrink-0 border-hairline bg-inset md:h-9" aria-label="Sort devices">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="ip">IP address</SelectItem>
                  <SelectItem value="usage">Usage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading && devices.length === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3 rounded-xl border border-hairline bg-panel p-4">
                    <div className="flex gap-3">
                      <Skeleton className="size-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              renderDeviceGrid(activeFilter.list, activeFilter.empty)
            )}
          </section>

          {/* Network side column */}
          <aside className="min-w-0 space-y-4" aria-label="Network">
            <UplinksCard />
            <WiFiCard radios={network.wifi?.radios ?? []} events={network.wifi?.events ?? []} devices={devices} />
            <SystemStatus systemInfo={systemInfo} />
          </aside>
        </div>
      </div>

      <BandwidthDialog
        device={selectedDevice}
        open={bandwidthDialogOpen}
        onOpenChange={setBandwidthDialogOpen}
        onSetLimit={setBandwidthLimit}
        onRemoveLimit={removeBandwidthLimit}
      />

      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentName={renameTarget?.currentName || ''}
        onSave={handleSaveRename}
      />

      <PriorityDialog
        device={selectedDevice}
        open={priorityDialogOpen}
        onOpenChange={setPriorityDialogOpen}
        onSetPriority={handleSavePriority}
        onRemovePriority={handleRemovePriority}
      />

      <DeviceDetailDialog
        device={detailDevice}
        open={detailMac !== null}
        onOpenChange={(open) => !open && setDetailMac(null)}
      />
    </AppShell>
  );
}
