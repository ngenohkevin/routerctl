'use client';

import { ArrowDown, ArrowUp, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TrafficStats } from '@/types';

interface TrafficTableProps {
  stats: TrafficStats[];
  isLoading: boolean;
}

function formatBytes(bytes: string | number): string {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = num;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatRate(rate: string | undefined): string {
  if (!rate) return '-';
  const num = parseInt(rate, 10);
  if (isNaN(num)) return rate;

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} Mbps`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)} Kbps`;
  }
  return `${num} bps`;
}

export function TrafficTable({ stats, isLoading }: TrafficTableProps) {
  // Filter out internal/virtual interfaces
  const physicalInterfaces = stats.filter(
    (s) =>
      !s.interface.startsWith('lo') &&
      !s.interface.includes('docker') &&
      !s.interface.includes('veth') &&
      !s.interface.includes('br-')
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Interface Traffic
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : physicalInterfaces.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No interface traffic data available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interface</TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowDown className="h-3 w-3 text-green-500" />
                    RX
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUp className="h-3 w-3 text-blue-500" />
                    TX
                  </span>
                </TableHead>
                <TableHead className="text-right">RX Rate</TableHead>
                <TableHead className="text-right">TX Rate</TableHead>
                <TableHead className="text-right">Packets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {physicalInterfaces.map((stat) => (
                <TableRow key={stat.interface}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {stat.interface}
                      {stat.interface.toLowerCase().includes('wlan') && (
                        <Badge variant="outline" className="text-xs">
                          WiFi
                        </Badge>
                      )}
                      {stat.interface.toLowerCase().includes('ether') && (
                        <Badge variant="secondary" className="text-xs">
                          Ethernet
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-500">
                    {formatBytes(stat.rxBytes)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-500">
                    {formatBytes(stat.txBytes)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatRate(stat.rxRate)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatRate(stat.txRate)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {parseInt(stat.rxPackets || '0', 10).toLocaleString()} /{' '}
                    {parseInt(stat.txPackets || '0', 10).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
