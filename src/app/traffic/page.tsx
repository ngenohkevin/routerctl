'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BandwidthChart } from '@/components/bandwidth-chart';
import { TrafficTable } from '@/components/traffic-table';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Stat, StatStrip } from '@/components/shell/stat';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { QueueStats, TrafficStats } from '@/types';

export default function TrafficPage() {
  const router = useRouter();
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [trafficStats, setTrafficStats] = useState<TrafficStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [queueRes, trafficRes] = await Promise.all([
        api.getQueueStats().catch(() => ({ stats: [] })),
        api.getTrafficStats().catch(() => ({ stats: [] })),
      ]);
      setQueueStats(queueRes.stats || []);
      setTrafficStats(trafficRes.stats || []);
    } catch {
      toast.error('Failed to fetch traffic data');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    // Auto-refresh every 10 seconds without re-triggering the loading skeleton
    // (otherwise chart axes reset and table rows flash every tick).
    const interval = setInterval(() => fetchData(false), 10000);
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
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Traffic"
          description="Live throughput per device queue, and totals per interface since the router last started."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => fetchData(true)}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          }
        />

        <StatStrip>
          <Stat label="Downloaded" value={formatBytes(totalDownload)} tone="link" />
          <Stat label="Uploaded" value={formatBytes(totalUpload)} tone="air" />
          <Stat label="Active queues" value={queueStats.length} />
          <Stat label="Interfaces" value={trafficStats.length} />
        </StatStrip>

        <BandwidthChart stats={queueStats} isLoading={isLoading} />
        <TrafficTable stats={trafficStats} isLoading={isLoading} />
      </div>
    </AppShell>
  );
}
