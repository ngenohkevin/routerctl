'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BandwidthChart } from '@/components/bandwidth-chart';
import { TrafficTable } from '@/components/traffic-table';
import { AgentStatus } from '@/components/agent-status';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { QueueStats, TrafficStats, HealthStatus } from '@/types';

export default function TrafficPage() {
  const router = useRouter();
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [trafficStats, setTrafficStats] = useState<TrafficStats[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
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
      const [queueRes, trafficRes, healthRes] = await Promise.all([
        api.getQueueStats().catch(() => ({ stats: [] })),
        api.getTrafficStats().catch(() => ({ stats: [] })),
        api.getHealth().catch(() => null),
      ]);
      setQueueStats(queueRes.stats || []);
      setTrafficStats(trafficRes.stats || []);
      setHealth(healthRes);
    } catch (error) {
      toast.error('Failed to fetch traffic data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate totals
  const totalDownload = trafficStats.reduce((acc, stat) => {
    return acc + parseInt(stat.rxBytes || '0', 10);
  }, 0);

  const totalUpload = trafficStats.reduce((acc, stat) => {
    return acc + parseInt(stat.txBytes || '0', 10);
  }, 0);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">Network Traffic</h1>
              <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                Real-time bandwidth monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AgentStatus health={health} isConnected={!!health?.routerConnected} />
            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Download
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {formatBytes(totalDownload)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {formatBytes(totalUpload)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Queues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStats.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Interfaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trafficStats.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Bandwidth Chart */}
        <BandwidthChart stats={queueStats} isLoading={isLoading} />

        {/* Interface Traffic Table */}
        <TrafficTable stats={trafficStats} isLoading={isLoading} />
      </div>
    </div>
  );
}
