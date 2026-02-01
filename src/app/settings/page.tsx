'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, ArrowLeft, Power, Server, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RebootDialog } from '@/components/reboot-dialog';
import { SchedulerDialog } from '@/components/scheduler-dialog';
import { ScheduledTasks } from '@/components/scheduled-tasks';
import { DnsSettingsDialog } from '@/components/dns-settings-dialog';
import { AgentStatus } from '@/components/agent-status';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { ScheduledTask, HealthStatus, SystemInfo, DnsSettings } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [dnsSettings, setDnsSettings] = useState<DnsSettings | null>(null);
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
      const [tasksRes, healthRes, systemRes, dnsRes] = await Promise.all([
        api.getScheduledTasks().catch(() => ({ tasks: [] })),
        api.getHealth().catch(() => null),
        api.getSystem().catch(() => null),
        api.getDnsSettings().catch(() => null),
      ]);
      setTasks(tasksRes.tasks || []);
      setHealth(healthRes);
      if (systemRes) {
        setSystemInfo(systemRes.system);
      }
      if (dnsRes) {
        setDnsSettings(dnsRes.settings);
      }
    } catch (error) {
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
    } catch (error) {
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                Router management and scheduled tasks
              </p>
            </div>
          </div>
          <AgentStatus health={health} isConnected={!!health?.routerConnected} />
        </div>

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

        {/* DNS Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              DNS Settings
            </CardTitle>
            <CardDescription>
              Configure DNS servers for the router. This affects all devices on the network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dnsSettings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">DNS Servers</p>
                  <p className="font-medium">
                    {dnsSettings.servers && dnsSettings.servers.length > 0
                      ? dnsSettings.servers.join(', ')
                      : 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Allow Remote Requests</p>
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
            <div className="flex flex-wrap gap-3 pt-2">
              <DnsSettingsDialog
                currentSettings={dnsSettings}
                onSave={handleSaveDnsSettings}
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
    </div>
  );
}
