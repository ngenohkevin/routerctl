'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Router, RefreshCw, Wifi, Cable, Ban, Settings, LogOut, ScrollText, Network, Gauge, Search, Activity, SearchX } from 'lucide-react';
import { api, isAuthenticated } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SystemStatus } from '@/components/system-status';
import { AgentStatus } from '@/components/agent-status';
import { BandwidthDialog } from '@/components/bandwidth-dialog';
import { RenameDialog } from '@/components/rename-dialog';
import { PriorityDialog } from '@/components/priority-dialog';
import { RebootDialog } from '@/components/reboot-dialog';
import { useDevicesStore } from '@/stores/devices';
import { toast } from 'sonner';
import type { Device } from '@/types';

export default function Dashboard() {
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    api.logout();
  };
  const {
    devices,
    systemInfo,
    health,
    isLoading,
    isConnected,
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
      await Promise.all([fetchHealth(), fetchDevices(), fetchSystemInfo()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReboot = async () => {
    try {
      await api.rebootRouter();
      toast.success('Router is rebooting. It will be back online shortly.');
    } catch (error) {
      toast.error('Failed to reboot router');
      throw error;
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

  // Exclude WAN devices from main list (they're upstream, not our network)
  const lanDevices = devices.filter((d) => d.interface !== 'WAN');

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
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <SearchX className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">
            {searchQuery.trim() ? `No devices match "${searchQuery.trim()}"` : emptyMessage}
          </p>
        </div>
      );
    }
    return (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
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

  return (
    <div className="min-h-screen p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Router className="h-7 w-7 md:h-8 md:w-8 text-primary" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">RouterCtl</h1>
                <p className="text-muted-foreground text-xs md:text-sm hidden sm:block">
                  Router Management Dashboard
                </p>
              </div>
            </div>
            <AgentStatus health={health} isConnected={isConnected} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/logs">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <ScrollText className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logs</span>
                </Button>
              </Link>
              <Link href="/dhcp">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Network className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">DHCP</span>
                </Button>
              </Link>
              <Link href="/speed-test">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Gauge className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Speed Test</span>
                </Button>
              </Link>
              <Link href="/traffic">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Activity className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Traffic</span>
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <RebootDialog
                onReboot={handleReboot}
                disabled={!health?.routerConnected}
              />
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3" onClick={handleLogout}>
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                WiFi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.wifi}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Cable className="h-4 w-4" />
                Ethernet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ethernet}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Blocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats.blocked}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Devices section */}
          <div className="lg:col-span-3 min-w-0 overflow-hidden">
            <Tabs defaultValue="all" className="space-y-4 min-w-0">
              <div className="w-full overflow-x-auto">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="all" className="flex-none">Connected ({stats.total})</TabsTrigger>
                  <TabsTrigger value="wifi" className="flex-none">WiFi ({stats.wifi})</TabsTrigger>
                  <TabsTrigger value="ethernet" className="flex-none">
                    Ethernet ({stats.ethernet})
                  </TabsTrigger>
                  {stats.disconnected > 0 && (
                    <TabsTrigger value="disconnected" className="flex-none">
                      Offline ({stats.disconnected})
                    </TabsTrigger>
                  )}
                  {stats.blocked > 0 && (
                    <TabsTrigger value="blocked" className="flex-none">
                      Blocked ({stats.blocked})
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* Search + sort */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, IP, MAC, vendor…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[130px] h-9 shrink-0">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Sort: Default</SelectItem>
                    <SelectItem value="name">Sort: Name</SelectItem>
                    <SelectItem value="ip">Sort: IP</SelectItem>
                    <SelectItem value="usage">Sort: Usage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="all" className="space-y-4">
                {isLoading && devices.length === 0 ? (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i}>
                        <CardHeader>
                          <Skeleton className="h-4 w-3/4" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  renderDeviceGrid(connectedDevices, 'No devices are connected right now')
                )}
              </TabsContent>

              <TabsContent value="wifi" className="space-y-4">
                {renderDeviceGrid(wifiDevices, 'No WiFi devices are connected')}
              </TabsContent>

              <TabsContent value="ethernet" className="space-y-4">
                {renderDeviceGrid(ethernetDevices, 'No Ethernet devices are connected')}
              </TabsContent>

              <TabsContent value="disconnected" className="space-y-4">
                {renderDeviceGrid(disconnectedDevices, 'No offline devices')}
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                {renderDeviceGrid(blockedDevices, 'No blocked devices')}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SystemStatus systemInfo={systemInfo} />

            {lastUpdated && (
              <p className="text-xs text-muted-foreground text-center">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
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
    </div>
  );
}
