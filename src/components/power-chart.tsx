'use client';

import { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { clock } from '@/lib/power';
import type { UPSPoint } from '@/types';

const config = {
  mains: { label: 'Mains', color: 'var(--chart-1)' },
  battery: { label: 'Battery', color: 'var(--chart-4)' },
} satisfies ChartConfig;

type Row = { t: number; mains: number; battery: number; onBattery: boolean };

/** Contiguous on-battery minutes as [from, to] in ms, for shading. */
function batteryRuns(rows: Row[]): [number, number][] {
  const runs: [number, number][] = [];
  let start: number | null = null;
  for (const r of rows) {
    if (r.onBattery && start === null) start = r.t;
    if (!r.onBattery && start !== null) {
      runs.push([start, r.t]);
      start = null;
    }
  }
  if (start !== null && rows.length) runs.push([start, rows[rows.length - 1].t + 60_000]);
  return runs;
}

/** 24 h of mains and battery voltage, power cuts shaded. */
export function PowerChart({ series, loading }: { series: UPSPoint[]; loading: boolean }) {
  const header = <PanelHeader title="Mains & battery · 24 h" icon={<LineChartIcon />} />;
  if (loading) {
    return (
      <Panel>
        {header}
        <Skeleton className="h-[240px] w-full" />
      </Panel>
    );
  }
  const rows: Row[] = series.map((p) => ({
    t: new Date(p.t).getTime(),
    mains: Math.round(p.mains),
    battery: p.battery,
    onBattery: p.onBattery,
  }));
  if (rows.length < 2) {
    return (
      <Panel>
        {header}
        <div className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-3">
          The chart fills in over the next few minutes.
        </div>
      </Panel>
    );
  }
  const runs = batteryRuns(rows);

  return (
    <Panel>
      <PanelHeader
        title="Mains & battery · 24 h"
        icon={<LineChartIcon />}
        aside={runs.length ? <span>{runs.length === 1 ? '1 cut shaded' : `${runs.length} cuts shaded`}</span> : undefined}
      />
      <ChartContainer config={config} className="h-[240px] w-full">
        <LineChart data={rows} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline-soft)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => clock(v)}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis yAxisId="mains" domain={[0, 260]} fontSize={11} tickLine={false} axisLine={false} width={44} unit=" V" />
          <YAxis
            yAxisId="battery"
            orientation="right"
            domain={[20, 28]}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={44}
            unit=" V"
          />
          {runs.map(([x1, x2]) => (
            <ReferenceArea key={x1} yAxisId="mains" x1={x1} x2={x2} fill="var(--amber)" fillOpacity={0.1} strokeOpacity={0} />
          ))}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const t = payload?.[0]?.payload?.t as number | undefined;
                  return t ? clock(t) : '';
                }}
                formatter={(value, name) => (
                  <span className="num font-mono">
                    {config[name as keyof typeof config]?.label ?? name} {Number(value).toFixed(name === 'battery' ? 1 : 0)} V
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line yAxisId="mains" type="stepAfter" dataKey="mains" stroke="var(--color-mains)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="battery" type="monotone" dataKey="battery" stroke="var(--color-battery)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </Panel>
  );
}
