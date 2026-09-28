'use client';

import { useState } from 'react';
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { cn } from '@/lib/utils';
import { formatMbps } from '@/lib/speed';
import type { NetSpeedTestResult } from '@/types';

interface SpeedHistoryChartProps {
  results: NetSpeedTestResult[];
  isLoading: boolean;
}

type Metric = 'download' | 'upload';

// One colour per line (not per direction): the lines are what's compared.
const LINE_COLORS = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-2)'];

const lineOf = (r: NetSpeedTestResult) => r.wanLabel || r.isp || 'Unknown';

/** Series key safe for CSS custom properties (--color-<key>). */
const keyOf = (line: string) => 'l_' + line.replace(/[^a-zA-Z0-9]/g, '_');

export function SpeedHistoryChart({ results, isLoading }: SpeedHistoryChartProps) {
  const [metric, setMetric] = useState<Metric>('download');

  if (isLoading && results.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Over time" icon={<LineChartIcon />} />
        <Skeleton className="h-[260px] w-full" />
      </Panel>
    );
  }

  if (results.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Over time" icon={<LineChartIcon />} />
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-strong text-sm text-ink-3">
          <LineChartIcon className="size-5 text-ink-4" />
          No results yet. Run a speed test to start the history.
        </div>
      </Panel>
    );
  }

  // Each line is its own series: mixing a 700 Mbps line and a 60 Mbps line in
  // one series draws a sawtooth that says nothing about either.
  const lines = [...new Set(results.map(lineOf))];
  const config = Object.fromEntries(
    lines.map((l, i) => [keyOf(l), { label: l, color: LINE_COLORS[i % LINE_COLORS.length] }])
  ) satisfies ChartConfig;

  // Oldest first, left to right; each point carries only its own line's value.
  const data = [...results].reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    [keyOf(lineOf(r))]: r[metric],
  }));

  return (
    <Panel>
      <PanelHeader
        title="Over time"
        icon={<LineChartIcon />}
        aside={
          <div className="inline-flex rounded-md border border-hairline bg-inset p-0.5" role="radiogroup" aria-label="Metric">
            {(['download', 'upload'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  'h-6 rounded-[5px] px-2.5 text-xs font-medium capitalize transition-colors duration-150',
                  metric === m ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
                )}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />
      <ChartContainer config={config} className="h-[260px] w-full">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline-soft)" />
          <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} unit="" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <span className="num font-mono">
                    {config[name as string]?.label ?? name} {formatMbps(value as number)} Mbps
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {lines.map((l) => (
            <Line
              key={l}
              type="monotone"
              dataKey={keyOf(l)}
              stroke={`var(--color-${keyOf(l)})`}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </Panel>
  );
}
