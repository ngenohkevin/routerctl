'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power, Server, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RebootDialog } from '@/components/reboot-dialog';
import { SchedulerDialog } from '@/components/scheduler-dialog';
import { ScheduledTasks } from '@/components/scheduled-tasks';
import { DnsSettingsDialog } from '@/components/dns-settings-dialog';
import { DefaultBandwidthCard } from '@/components/default-bandwidth-card';
import { DhcpDnsDialog } from '@/components/dhcp-dns-dialog';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { ScheduledTask, HealthStatus, SystemInfo, DnsSettings, DHCPNetwork } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [dnsSettings, setDnsSettings] = useState<DnsSettings | null>(null);
  const [dhcpNetworks, setDhcpNetworks] = useState<DHCPNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, healthRes, systemRes, dnsRes, dhcpRes] = await Promise.all([
        api.getScheduledTasks().catch(() => ({ tasks: [] })),
        api.getHealth().catch(() => null),
        api.getSystem().catch(() => null),
        api.getDnsSettings().catch(() => null),
        api.getDhcpNetworks().catch(() => ({ networks: [] })),
      ]);
      setTasks(tasksRes.tasks || []);
      setHealth(healthRes);
      if (systemRes) {
        setSystemInfo(systemRes.system);
      }
      if (dnsRes) {
        setDnsSettings(dnsRes.settings);
      }
      setDhcpNetworks(dhcpRes.networks || []);
    } catch {
      toast.error('Failed to fetch settings data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReboot = async () => {
    try {
      await api.rebootRouter();
      toast.success('Router is rebooting. It will be back online shortly.');
    } catch (error) {
      toast.error('Failed to reboot router');
      throw error;
    }
  };

  const handleSchedule = async (name: string, startTime: string, interval: string) => {
    try {
      // Convert 'once' back to empty string for the API
      const actualInterval = interval === 'once' ? '' : interval;
      await api.scheduleReboot(name, startTime, actualInterval);
      toast.success('Scheduled reboot created');
      fetchData(); // Refresh task list
    } catch (error) {
      toast.error('Failed to schedule reboot');
      throw error;
    }
  };

  const handleDeleteTask = async (name: string) => {
    try {
      await api.removeScheduledTask(name);
      toast.success('Scheduled task removed');
      setTasks(tasks.filter((t) => t.name !== name));
    } catch (error) {
      toast.error('Failed to delete scheduled task');
      throw error;
    }
  };

  const handleFlushDns = async () => {
    try {
      await api.flushDnsCache();
      toast.success('DNS cache flushed');
    } catch {
      toast.error('Failed to flush DNS cache');
    }
  };

  const handleSaveDnsSettings = async (servers: string[], allowRemoteRequests: boolean) => {
    try {
      await api.setDnsSettings(servers, allowRemoteRequests);
      toast.success('DNS settings updated');
      // Refresh settings
      const dnsRes = await api.getDnsSettings().catch(() => null);
      if (dnsRes) {
        setDnsSettings(dnsRes.settings);
      }
    } catch (error) {
      toast.error('Failed to update DNS settings');
      throw error;
    }
  };

  const handleSaveDhcpDns = async (networkId: string, dnsServers: string[]) => {
    try {
      await api.setDhcpNetworkDns(networkId, dnsServers);
      toast.success('DHCP DNS settings updated');
      // Refresh DHCP networks
      const dhcpRes = await api.getDhcpNetworks().catch(() => ({ networks: [] }));
      setDhcpNetworks(dhcpRes.networks || []);
    } catch (error) {
      toast.error('Failed to update DHCP DNS settings');
      throw error;
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          title="Settings"
          description="Router-wide controls: default bandwidth, DNS, and scheduled reboots and tasks."
        />

        {/* Router Info */}
        {systemInfo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5" />
                Router Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Platform</p>
                  <p className="font-medium">{systemInfo.platform}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="font-medium">{systemInfo.version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Board</p>
                  <p className="font-medium">{systemInfo.boardName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-medium">{systemInfo.uptime}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Router Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Power className="h-5 w-5" />
              Router Management
            </CardTitle>
            <CardDescription>
              Reboot the router or manage scheduled maintenance tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <RebootDialog
                onReboot={handleReboot}
                disabled={!health?.routerConnected}
              />
              <SchedulerDialog onSchedule={handleSchedule} />
            </div>
          </CardContent>
        </Card>

        {/* Default Bandwidth Limit */}
        <DefaultBandwidthCard disabled={!health?.routerConnected} />

        {/* DNS Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              DNS Settings
            </CardTitle>
            <CardDescription>
              Configure DNS servers for the router and DHCP clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Router DNS */}
            <div>
              <p className="text-sm font-medium mb-2">Router DNS</p>
              {dnsSettings && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Servers</p>
                    <p className="font-medium">
                      {dnsSettings.servers && dnsSettings.servers.length > 0
                        ? dnsSettings.servers.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remote Requests</p>
                    <p className="font-medium">
                      {dnsSettings.allowRemoteRequests ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  {dnsSettings.cacheSize && (
                    <div>
                      <p className="text-muted-foreground">Cache Size</p>
                      <p className="font-medium">{dnsSettings.cacheSize}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DHCP DNS */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">DHCP Client DNS</p>
              {dhcpNetworks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Network</p>
                    <p className="font-medium">{dhcpNetworks[0].address}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">DNS Servers</p>
                    <p className="font-medium">
                      {dhcpNetworks[0].dnsServers && dhcpNetworks[0].dnsServers.length > 0
                        ? dhcpNetworks[0].dnsServers.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No DHCP networks configured</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <DnsSettingsDialog
                currentSettings={dnsSettings}
                onSave={handleSaveDnsSettings}
                disabled={!health?.routerConnected}
              />
              <DhcpDnsDialog
                network={dhcpNetworks[0] || null}
                onSave={handleSaveDhcpDns}
                disabled={!health?.routerConnected}
              />
              <Button variant="outline" size="sm" onClick={handleFlushDns}>
                Flush DNS Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Tasks */}
        <ScheduledTasks
          tasks={tasks}
          isLoading={isLoading}
          onDelete={handleDeleteTask}
          onRefresh={fetchData}
        />
      </div>
    </AppShell>
  );
}
