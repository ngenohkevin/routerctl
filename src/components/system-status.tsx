'use client';

import { Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { cn, formatBytes, formatUptime, parseMemory, parseCPULoad } from '@/lib/utils';
import type { SystemInfo } from '@/types';

interface SystemStatusProps {
  systemInfo: SystemInfo | null;
  identity?: string;
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  const tone = pct >= 90 ? 'bg-fault' : pct >= 75 ? 'bg-amber' : 'bg-ink-3';
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-3">{label}</span>
        <span className="num font-mono text-ink-2">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-inset">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tone)}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%`, transitionTimingFunction: 'var(--ease-out)' }}
        />
      </div>
    </div>
  );
}

/** The router's own health: load, memory, uptime, firmware. */
export function SystemStatus({ systemInfo, identity }: SystemStatusProps) {
  if (!systemInfo) {
    return (
      <Panel>
        <PanelHeader title="Router" icon={<Server />} />
        <div className="space-y-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-1 w-full" />
          <Skeleton className="h-1 w-full" />
        </div>
      </Panel>
    );
  }

  const memory = parseMemory(systemInfo.freeMemory, systemInfo.totalMemory);
  const cpu = parseCPULoad(systemInfo.cpuLoad);

  return (
    <Panel>
      <PanelHeader
        title={identity || systemInfo.boardName}
        icon={<Server />}
        aside={<span className="font-mono">up {formatUptime(systemInfo.uptime)}</span>}
      />
      <div className="space-y-3.5">
        <Meter label="CPU" value={`${cpu}%`} pct={cpu} />
        <Meter label="Memory" value={`${formatBytes(memory.used)} / ${formatBytes(memory.total)}`} pct={memory.percentage} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline-soft pt-3.5 text-xs">
        <div>
          <dt className="text-ink-4">RouterOS</dt>
          <dd className="num mt-0.5 font-mono text-ink-2">{systemInfo.version}</dd>
        </div>
        <div>
          <dt className="text-ink-4">Platform</dt>
          <dd className="mt-0.5 text-ink-2">
            {systemInfo.platform} · {systemInfo.architecture}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
