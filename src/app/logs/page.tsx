'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Search,
  Filter,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Stat, StatStrip } from '@/components/shell/stat';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { LogEntry } from '@/types';

// Topic badge colors based on severity/type
const topicColors: Record<string, string> = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  critical: 'bg-red-600/20 text-red-300 border-red-600/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  system: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  interface: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  firewall: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dhcp: 'bg-green-500/20 text-green-400 border-green-500/30',
  wireless: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  dns: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  account: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function getTopicColor(topics: string): string {
  const topicList = topics.split(',').map((t) => t.trim().toLowerCase());
  for (const topic of topicList) {
    if (topicColors[topic]) {
      return topicColors[topic];
    }
  }
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  // useCallback keyed on the filters that affect the request, so the effects
  // below can depend on fetchData directly (satisfies exhaustive-deps without
  // re-creating the fetch on every render).
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const topicFilter = selectedTopic !== 'all' ? selectedTopic : undefined;
      const [logsRes, topicsRes] = await Promise.all([
        api.getLogs(limit, topicFilter).catch(() => ({ logs: [], count: 0 })),
        api.getLogTopics().catch(() => ({ topics: [] })),
      ]);
      setLogs(logsRes.logs || []);
      setTopics(topicsRes.topics || []);
    } catch {
      toast.error('Failed to fetch logs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTopic, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.topics.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const errorCount = logs.filter((l) =>
      l.topics.toLowerCase().includes('error')
    ).length;
    const warningCount = logs.filter((l) =>
      l.topics.toLowerCase().includes('warning')
    ).length;
    return { total: logs.length, errors: errorCount, warnings: warningCount };
  }, [logs]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Router logs"
          description="What the router has been saying — logins, DHCP, Wi-Fi and link events."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => fetchData()} disabled={isRefreshing}>
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <StatStrip count={3}>
          <Stat label="Entries" value={stats.total} />
          <Stat label="Errors" value={stats.errors} tone={stats.errors > 0 ? 'fault' : 'ink'} />
          <Stat label="Warnings" value={stats.warnings} tone={stats.warnings > 0 ? 'amber' : 'ink'} />
        </StatStrip>

        {/* Filters */}
        <Card className="py-3 md:py-3">
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Topic Filter */}
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic} value={topic}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Limit */}
              <Select
                value={limit.toString()}
                onValueChange={(v) => setLimit(parseInt(v, 10))}
              >
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 logs</SelectItem>
                  <SelectItem value="100">100 logs</SelectItem>
                  <SelectItem value="200">200 logs</SelectItem>
                  <SelectItem value="500">500 logs</SelectItem>
                </SelectContent>
              </Select>

              {/* Auto Refresh */}
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label
                  htmlFor="auto-refresh"
                  className="flex items-center gap-1 text-sm cursor-pointer"
                >
                  {autoRefresh ? (
                    <Play className="h-3 w-3 text-green-500" />
                  ) : (
                    <Pause className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span>Auto-refresh</span>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs — stacked on phones so the message gets the width, table from md */}
        <Card className="py-0 md:py-0">
          <CardContent className="p-0 md:p-0">
            <ul className="divide-y divide-hairline-soft md:hidden">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <li key={i} className="space-y-2 px-4 py-3">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </li>
                ))
              ) : filteredLogs.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-3">No logs found</li>
              ) : (
                filteredLogs.map((log) => (
                  <li key={log.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="num font-mono text-[11px] text-ink-4">{log.time}</span>
                      <Badge variant="outline" className={`text-[10px] ${getTopicColor(log.topics)}`}>
                        {log.topics}
                      </Badge>
                    </div>
                    <p className="mt-1.5 break-words font-mono text-[12.5px] leading-5 text-ink-2">{log.message}</p>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead className="w-[120px]">Topics</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <p className="text-muted-foreground">No logs found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {log.time}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getTopicColor(log.topics)}`}
                          >
                            {log.topics}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.message}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
