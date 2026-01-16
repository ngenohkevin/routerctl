'use client';

import { Cpu, HardDrive, Clock, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SystemInfo } from '@/types';
import { formatBytes, formatUptime, parseMemory, parseCPULoad } from '@/lib/utils';

interface SystemStatusProps {
  systemInfo: SystemInfo | null;
  identity?: string;
}

export function SystemStatus({ systemInfo, identity }: SystemStatusProps) {
  if (!systemInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading system information...</p>
        </CardContent>
      </Card>
    );
  }

  const memory = parseMemory(systemInfo.freeMemory, systemInfo.totalMemory);
  const cpuLoad = parseCPULoad(systemInfo.cpuLoad);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          {identity || systemInfo.boardName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Platform</span>
            <p className="font-medium">{systemInfo.platform}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Version</span>
            <p className="font-medium">{systemInfo.version}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Architecture</span>
            <p className="font-medium">{systemInfo.architecture}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Board</span>
            <p className="font-medium">{systemInfo.boardName}</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span>CPU Load</span>
              </div>
              <span className="font-medium">{cpuLoad}%</span>
            </div>
            <Progress value={cpuLoad} className="h-2" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span>Memory</span>
              </div>
              <span className="font-medium">
                {formatBytes(memory.used)} / {formatBytes(memory.total)}
              </span>
            </div>
            <Progress value={memory.percentage} className="h-2" />
          </div>

          <div className="flex items-center justify-between text-sm pt-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Uptime</span>
            </div>
            <span className="font-medium">{formatUptime(systemInfo.uptime)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
