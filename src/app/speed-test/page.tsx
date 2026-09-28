'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Square, RefreshCw, Trash2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Panel } from '@/components/shell/panel';
import { Led } from '@/components/shell/led';
import { SpeedGauge, type GaugeTone } from '@/components/speed-gauge';
import { SpeedResultCards } from '@/components/speed-result-cards';
import { SpeedTrace } from '@/components/speed-trace';
import { LatencyTable } from '@/components/latency-table';
import { SpeedHistoryChart } from '@/components/speed-history-chart';
import { SpeedHistoryTable } from '@/components/speed-history-table';
import { StreamingTest } from '@/components/streaming-test';
import { UplinksCard } from '@/components/uplinks-card';
import { api, isAuthenticated } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSpeedTest, type SpeedTestState } from '@/hooks/use-speed-test';
import { toast } from 'sonner';
import type { NetSpeedTestResult, LatencyTarget, SpeedTestServer } from '@/types';

type Tab = 'speedtest' | 'streaming' | 'latency' | 'history';

/** What the gauge shows for each state of the test. */
function gaugeView(s: SpeedTestState): { value: number | null; mode: 'speed' | 'ping'; tone: GaugeTone; caption: string } {
  if (s.status === 'running') {
    switch (s.phase) {
      case 'download':
        return { value: s.live, mode: 'speed', tone: 'link', caption: 'Download' };
      case 'upload':
        return { value: s.live, mode: 'speed', tone: 'air', caption: 'Upload' };
      case 'ping':
        return { value: s.live > 0 ? s.live : null, mode: 'ping', tone: 'ink', caption: 'Ping' };
      default:
        return { value: null, mode: 'ping', tone: 'ink', caption: 'Preparing' };
    }
  }
  if (s.status === 'done' && s.download != null) {
    return { value: s.download, mode: 'speed', tone: 'link', caption: 'Download' };
  }
  const caption = s.status === 'cancelled' ? 'Cancelled' : s.status === 'error' ? 'Failed' : 'Ready';
  return { value: null, mode: 'speed', tone: 'ink', caption };
}

/** One line under the gauge saying what is happening, in plain words. */
function statusLine(s: SpeedTestState): { text: string; tone?: 'fault' } {
  const where = s.server ? `${s.server.sponsor}, ${s.server.name}` : null;
  switch (s.status) {
    case 'running':
      switch (s.phase) {
        case 'ping':
          return { text: where ? `Measuring ping to ${where}` : 'Measuring ping…' };
        case 'download':
          return { text: where ? `Downloading from ${where}` : 'Testing download…' };
        case 'upload':
          return { text: where ? `Uploading to ${where}` : 'Testing upload…' };
        default:
          return { text: s.message ?? 'Starting…' };
      }
    case 'done':
      return {
        text: s.server
          ? `${s.server.sponsor}, ${s.server.name} · ${s.server.distance} km`
          : 'Finished',
      };
    case 'error':
      return { text: s.error ?? 'Speed test failed', tone: 'fault' };
    case 'cancelled':
      return { text: 'Cancelled — nothing was saved' };
    default:
      return { text: 'Tests the line the router is using now. To test one line on its own, use Test on the right.' };
  }
}

export default function SpeedTestPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('speedtest');

  // History (shared by the History tab and the post-test refresh)
  const [history, setHistory] = useState<NetSpeedTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Server choice ('' = auto-pick nearest by latency, the agent's default)
  const [servers, setServers] = useState<SpeedTestServer[]>([]);
  const [serverID, setServerID] = useState('');

  const [latencyTargets, setLatencyTargets] = useState<LatencyTarget[]>([]);
  const [latencyLoading, setLatencyLoading] = useState(false);

  // Bumped when a test completes so the uplinks rail refreshes at once
  const [uplinkRefresh, setUplinkRefresh] = useState(0);
  const [streamingRunning, setStreamingRunning] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getSpeedTestHistory(50);
      setHistory(res.results || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const onFinished = useCallback(() => {
    fetchHistory();
    setUplinkRefresh((n) => n + 1);
  }, [fetchHistory]);

  const { state, start, cancel, running } = useSpeedTest(onFinished);

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchHistory();
    api.listSpeedTestServers().then((r) => setServers(r.servers || [])).catch(() => setServers([]));
  }, [fetchHistory]);

  useEffect(() => {
    if (state.status === 'error' && state.error) toast.error(state.error);
  }, [state.status, state.error]);

  const run = (wan?: string, line?: string) => {
    if (running || streamingRunning) return;
    start({ serverID: serverID || undefined, wan, line });
  };

  const runLatencyTest = async () => {
    setLatencyLoading(true);
    try {
      const res = await api.runNetLatency();
      setLatencyTargets(res.result.targets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Latency test failed');
    } finally {
      setLatencyLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await api.clearSpeedTestHistory();
      setHistory([]);
      toast.success('History cleared');
    } catch {
      toast.error('Failed to clear history');
    }
  };

  const gauge = gaugeView(state);
  const status = statusLine(state);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Speed test"
          description="Measured from the Raspberry Pi — test either line on its own, check streaming, latency and history."
        />

        {/* Every tab stays mounted: switching away must not kill a running test. */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-6">
          <TabsList className="grid h-10 w-full grid-cols-4 md:inline-grid md:w-auto">
            <TabsTrigger value="speedtest" className="gap-1.5">
              Speed Test
              {running && tab !== 'speedtest' && <Led tone="link" live label="Running" />}
            </TabsTrigger>
            <TabsTrigger value="streaming" className="gap-1.5">
              Streaming
              {streamingRunning && tab !== 'streaming' && <Led tone="link" live label="Running" />}
            </TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="speedtest" forceMount className="space-y-6 data-[state=inactive]:hidden">
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel className="flex flex-col items-center justify-center gap-5 lg:col-span-2">
                {/* Which line, as the internet sees it */}
                <div className="flex min-h-5 w-full items-center justify-between gap-3 text-xs text-ink-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Led
                      tone={running ? 'link' : state.status === 'error' ? 'fault' : state.status === 'done' ? 'link' : 'off'}
                      live={running}
                      label={running ? 'Test running' : 'Idle'}
                    />
                    <span className="truncate">
                      {state.line ? (
                        <>Via <span className="font-medium text-ink">{state.line}</span></>
                      ) : running ? (
                        'Via the current primary line'
                      ) : (
                        'Ready'
                      )}
                      {state.isp && <span className="text-ink-4"> · seen as {state.isp}</span>}
                    </span>
                  </span>
                  {state.jitter != null && state.status === 'done' && (
                    <span className="num shrink-0 font-mono text-ink-4">jitter {state.jitter.toFixed(1)} ms</span>
                  )}
                </div>

                <SpeedGauge value={gauge.value} mode={gauge.mode} tone={gauge.tone} caption={gauge.caption} />

                <p
                  className={cn(
                    'min-h-5 max-w-md text-center text-sm',
                    status.tone === 'fault' ? 'text-fault' : 'text-ink-2'
                  )}
                  aria-live="polite"
                >
                  {status.text}
                </p>

                <SpeedTrace download={state.trace.download} upload={state.trace.upload} phase={state.phase} />

                <div className="flex w-full max-w-sm flex-col items-stretch gap-2.5">
                  {running ? (
                    <Button size="lg" variant="outline" onClick={cancel} className="gap-2 border-hairline-strong">
                      <Square className="size-3.5 fill-current" />
                      Cancel test
                    </Button>
                  ) : (
                    <Button size="lg" onClick={() => run()} disabled={streamingRunning} className="gap-2">
                      <Play className="size-4" />
                      {state.status === 'idle' ? 'Run speed test' : 'Run again'}
                    </Button>
                  )}
                  <Select
                    value={serverID || 'auto'}
                    onValueChange={(v) => setServerID(v === 'auto' ? '' : v)}
                    disabled={running}
                  >
                    <SelectTrigger className="h-8 w-full text-xs text-ink-3" aria-label="Speed test server">
                      <SelectValue placeholder="Nearest server (auto)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Nearest server (auto)</SelectItem>
                      {servers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.sponsor} — {s.name}, {s.country} ({s.distance} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {streamingRunning && (
                    <p className="text-center text-xs text-ink-3">A streaming test is running — one test at a time.</p>
                  )}
                </div>
              </Panel>

              <UplinksCard
                onTest={(iface, label) => run(iface, label)}
                allowSetPrimary
                disabled={running || streamingRunning}
                refreshToken={uplinkRefresh}
              />
            </div>

            {state.status !== 'idle' && <SpeedResultCards state={state} />}
          </TabsContent>

          <TabsContent value="streaming" forceMount className="data-[state=inactive]:hidden">
            <StreamingTest
              lastDownloadFromSpeedTest={state.download}
              blocked={running}
              onRunningChange={setStreamingRunning}
            />
          </TabsContent>

          <TabsContent value="latency" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Latency</h2>
                <p className="text-sm text-ink-3">Handshake time to local and internet hosts.</p>
              </div>
              <Button onClick={runLatencyTest} disabled={latencyLoading} className="gap-2">
                {latencyLoading ? <RefreshCw className="size-4 animate-spin" /> : <Radio className="size-4" />}
                {latencyLoading ? 'Testing…' : 'Run latency test'}
              </Button>
            </div>
            <LatencyTable targets={latencyTargets} isLoading={latencyLoading} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">History</h2>
                <p className="text-sm text-ink-3">
                  {history.length} result{history.length !== 1 ? 's' : ''} saved
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
                {history.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearHistory} className="gap-1.5 text-fault hover:text-fault">
                    <Trash2 className="size-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <SpeedHistoryChart results={history} isLoading={historyLoading} />
            <SpeedHistoryTable results={history} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
