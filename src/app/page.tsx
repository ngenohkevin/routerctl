'use client';

import { useEffect, useState } from 'react';
import { Router, RefreshCw, Wifi, Cable, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DeviceCard } from '@/components/device-card';
import { SystemStatus } from '@/components/system-status';
import { AgentStatus } from '@/components/agent-status';
import { BandwidthDialog } from '@/components/bandwidth-dialog';
import { RenameDialog } from '@/components/rename-dialog';
import { PriorityDialog } from '@/components/priority-dialog';
import { useDevicesStore } from '@/stores/devices';
import { toast } from 'sonner';
import type { Device } from '@/types';

export default function Dashboard() {
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
    subscribeToEvents,
  } = useDevicesStore();

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [bandwidthDialogOpen, setBandwidthDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ mac: string; currentName: string } | null>(null);

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

  const handleRefresh = () => {
    fetchHealth();
    fetchDevices();
    fetchSystemInfo();
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

  // Helper to check if device is WiFi (has signal, is mobile type, or has private MAC)
  const mobileTypes = ['phone', 'tablet', 'mobile'];
  const isWifiDevice = (d: Device) =>
    !!d.signalStrength ||
    mobileTypes.includes(d.deviceType?.toLowerCase() || '') ||
    d.vendor === 'Private Address';

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

  const blockedDevices = devices.filter((d) => d.isBlocked);

  const stats = {
    total: connectedDevices.length,
    wifi: wifiDevices.length,
    ethernet: ethernetDevices.length,
    blocked: blockedDevices.length,
    disconnected: disconnectedDevices.length,
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Router className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">RouterCtl</h1>
              <p className="text-muted-foreground text-sm">
                Router Management Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AgentStatus health={health} isConnected={isConnected} />
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
          <div className="lg:col-span-3">
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">Connected ({stats.total})</TabsTrigger>
                <TabsTrigger value="wifi">WiFi ({stats.wifi})</TabsTrigger>
                <TabsTrigger value="ethernet">
                  Ethernet ({stats.ethernet})
                </TabsTrigger>
                {stats.disconnected > 0 && (
                  <TabsTrigger value="disconnected">
                    Offline ({stats.disconnected})
                  </TabsTrigger>
                )}
                {stats.blocked > 0 && (
                  <TabsTrigger value="blocked">
                    Blocked ({stats.blocked})
                  </TabsTrigger>
                )}
              </TabsList>

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
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {connectedDevices.map((device) => (
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
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="wifi" className="space-y-4">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {wifiDevices.map((device) => (
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
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="ethernet" className="space-y-4">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {ethernetDevices.map((device) => (
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
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="disconnected" className="space-y-4">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {disconnectedDevices.map((device) => (
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
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {blockedDevices.map((device) => (
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
                    />
                  ))}
                </div>
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
    </div>
  );
}
