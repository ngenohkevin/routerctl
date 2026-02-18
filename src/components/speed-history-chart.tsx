'use client';

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
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
import type { NetSpeedTestResult } from '@/types';

interface SpeedHistoryChartProps {
  results: NetSpeedTestResult[];
  isLoading: boolean;
}

const chartConfig = {
  download: {
    label: 'Download',
    color: 'hsl(142, 76%, 36%)',
  },
  upload: {
    label: 'Upload',
    color: 'hsl(217, 91%, 60%)',
  },
  ping: {
    label: 'Ping',
    color: 'hsl(45, 93%, 47%)',
  },
} satisfies ChartConfig;

export function SpeedHistoryChart({ results, isLoading }: SpeedHistoryChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Speed Test History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Speed Test History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No speed test history yet. Run a test to start tracking.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Reverse so oldest is first (left to right chronological)
  const chartData = [...results].reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    download: r.download,
    upload: r.upload,
    ping: r.ping,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speed Test History</CardTitle>
        <CardDescription>
          Download and upload speeds over time (Mbps)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span>
                      {name === 'download' ? 'Download' : name === 'upload' ? 'Upload' : 'Ping'}:{' '}
                      {(value as number).toFixed(2)} {name === 'ping' ? 'ms' : 'Mbps'}
                    </span>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="download"
              stroke="var(--color-download)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="upload"
              stroke="var(--color-upload)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
