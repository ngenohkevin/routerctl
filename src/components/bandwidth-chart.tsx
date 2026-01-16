'use client';

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { QueueStats } from '@/types';

interface BandwidthChartProps {
  stats: QueueStats[];
  isLoading: boolean;
}

const chartConfig = {
  download: {
    label: 'Download',
    color: 'hsl(142, 76%, 36%)', // Green
  },
  upload: {
    label: 'Upload',
    color: 'hsl(217, 91%, 60%)', // Blue
  },
} satisfies ChartConfig;

interface FormattedData {
  name: string;
  download: number;
  upload: number;
  target: string;
}

function formatBytesForChart(bytes: string | number, useGB: boolean): number {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return 0;

  if (useGB) {
    // Convert to GB
    return parseFloat((num / (1024 * 1024 * 1024)).toFixed(2));
  }
  // Convert to MB
  return parseFloat((num / (1024 * 1024)).toFixed(2));
}

function formatBytesDisplay(bytes: number, useGB: boolean): string {
  if (useGB) {
    return `${bytes.toFixed(2)} GB`;
  }
  return `${bytes.toFixed(2)} MB`;
}

function getDeviceName(target: string, name: string): string {
  // Clean the target (remove /32 suffix if present)
  const cleanTarget = target?.replace('/32', '') || '';

  // If target looks like an IP, show last two octets
  if (cleanTarget.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const parts = cleanTarget.split('.');
    return `${parts[2]}.${parts[3]}`;
  }

  // If we have a queue name that's different from target, use it
  if (name && name !== cleanTarget) {
    // Remove common prefixes
    const cleanName = name
      .replace(/^(queue-|limit-|bw-)/i, '')
      .replace(/(-limit|-queue|-bw)$/i, '')
      .trim();

    if (cleanName && !cleanName.match(/^\d+\.\d+\.\d+\.\d+/)) {
      return cleanName;
    }
  }

  return cleanTarget || 'Unknown';
}

export function BandwidthChart({ stats, isLoading }: BandwidthChartProps) {
  // Determine if we should use GB or MB based on max value
  const maxBytes = Math.max(
    ...stats.map((s) => Math.max(
      parseInt(s.bytesIn || '0', 10),
      parseInt(s.bytesOut || '0', 10)
    ))
  );
  const useGB = maxBytes > 1024 * 1024 * 1024; // > 1 GB
  const unit = useGB ? 'GB' : 'MB';

  // Transform stats to chart data
  const chartData: FormattedData[] = stats.map((stat) => ({
    name: getDeviceName(stat.target, stat.name),
    download: formatBytesForChart(stat.bytesIn, useGB),
    upload: formatBytesForChart(stat.bytesOut, useGB),
    target: stat.target,
  }));

  // Sort by total traffic (download + upload)
  chartData.sort((a, b) => (b.download + b.upload) - (a.download + a.upload));

  // Limit to top 10 devices
  const topDevices = chartData.slice(0, 10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bandwidth by Device</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (topDevices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bandwidth by Device</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No bandwidth data available. Set bandwidth limits on devices to see stats.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bandwidth by Device</CardTitle>
        <CardDescription>
          Traffic usage for devices with bandwidth queues (in {unit})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={topDevices}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
              label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span>
                      {name === 'download' ? 'Download' : 'Upload'}: {formatBytesDisplay(value as number, useGB)}
                    </span>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="download"
              fill="var(--color-download)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
            <Bar
              dataKey="upload"
              fill="var(--color-upload)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
