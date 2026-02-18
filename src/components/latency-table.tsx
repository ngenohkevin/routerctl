'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { LatencyTarget } from '@/types';

interface LatencyTableProps {
  targets: LatencyTarget[];
  isLoading: boolean;
}

function pingColor(ms: number): string {
  if (ms <= 0) return 'text-muted-foreground';
  if (ms < 20) return 'text-green-500';
  if (ms < 100) return 'text-yellow-500';
  return 'text-red-500';
}

function pingBadge(ms: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (ms <= 0) return 'secondary';
  if (ms < 20) return 'default';
  if (ms < 100) return 'outline';
  return 'destructive';
}

export function LatencyTable({ targets, isLoading }: LatencyTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latency Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (targets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latency Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Run a latency test to see results
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Ping</TableHead>
              <TableHead className="hidden sm:table-cell">Min</TableHead>
              <TableHead className="hidden sm:table-cell">Max</TableHead>
              <TableHead>Jitter</TableHead>
              <TableHead>Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((t) => (
              <TableRow key={t.host}>
                <TableCell>
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground text-xs block">{t.host}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {t.error ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : (
                    <span className={`font-mono font-medium ${pingColor(t.ping)}`}>
                      {t.ping.toFixed(1)} ms
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="font-mono text-muted-foreground">
                    {t.error ? '—' : `${t.min.toFixed(1)} ms`}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="font-mono text-muted-foreground">
                    {t.error ? '—' : `${t.max.toFixed(1)} ms`}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono">
                    {t.error ? '—' : `${t.jitter.toFixed(1)} ms`}
                  </span>
                </TableCell>
                <TableCell>
                  {t.error ? (
                    <span className="text-destructive text-xs">{t.error}</span>
                  ) : (
                    <Badge variant={t.loss > 0 ? 'destructive' : 'outline'}>
                      {t.loss.toFixed(0)}%
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
