'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gauge, ArrowLeft, RefreshCw, Play, Trash2, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AgentStatus } from '@/components/agent-status';
import { SpeedGauge } from '@/components/speed-gauge';
import { SpeedResultCards } from '@/components/speed-result-cards';
import { LatencyTable } from '@/components/latency-table';
import { SpeedHistoryChart } from '@/components/speed-history-chart';
import { StreamingTest } from '@/components/streaming-test';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, isAuthenticated } from '@/lib/api';
import { UplinksCard } from '@/components/uplinks-card';
import { toast } from 'sonner';
import type { HealthStatus, NetSpeedTestResult, LatencyTarget, SpeedTestServer } from '@/types';

type SpeedPhase = 'idle' | 'ping' | 'download' | 'upload' | 'done';

export default function SpeedTestPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Speed test state
  const [phase, setPhase] = useState<SpeedPhase>('idle');
  const [gaugeValue, setGaugeValue] = useState(0);
  const [gaugePing, setGaugePing] = useState(0);
  const [gaugeLabel, setGaugeLabel] = useState('Ready');
  const [lastResult, setLastResult] = useState<NetSpeedTestResult | null>(null);

  // Progressive result cards — show each metric as its phase completes
  const [cardPing, setCardPing] = useState<number | null>(null);
  const [cardJitter, setCardJitter] = useState<number | null>(null);
  const [cardDownload, setCardDownload] = useState<number | null>(null);
  const [cardUpload, setCardUpload] = useState<number | null>(null);
  const [isp, setIsp] = useState<string | null>(null);
  // Which uplink the current/last test ran through ("Faiba", "Vilcom")
  const [testedLine, setTestedLine] = useState<string | null>(null);
  // Bumped when a test completes so the uplinks rail refreshes instantly
  const [uplinkRefresh, setUplinkRefresh] = useState(0);

  // Latency state
  const [latencyTargets, setLatencyTargets] = useState<LatencyTarget[]>([]);
  const [latencyLoading, setLatencyLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<NetSpeedTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Server selection ('' = auto-pick nearest by latency, the backend default)
  const [servers, setServers] = useState<SpeedTestServer[]>([]);
  const [selectedServerID, setSelectedServerID] = useState<string>('');
  const [serversLoading, setServersLoading] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => null);
    fetchHistory();
    loadServers();
  }, []);

  const loadServers = async () => {
    setServersLoading(true);
    try {
      const res = await api.listSpeedTestServers();
      setServers(res.servers || []);
    } catch {
      // Non-fatal — auto-pick still works without an explicit list.
      setServers([]);
    } finally {
      setServersLoading(false);
    }
  };

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getSpeedTestHistory(50);
      setHistory(res.results || []);
    } catch {
      // Silently handle — may not have history yet
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const startSpeedTest = (wan?: string, wanLabel?: string) => {
    if (phase !== 'idle' && phase !== 'done') return;

    setLastResult(null);
    setGaugeValue(0);
    setGaugePing(0);
    setPhase('ping');
    setGaugeLabel(wanLabel ? `Measuring ping via ${wanLabel}...` : 'Measuring ping...');
    setCardPing(null);
    setCardJitter(null);
    setCardDownload(null);
    setCardUpload(null);
    setIsp(null);
    setTestedLine(wanLabel ?? null);

    let pingDone = false;
    let downloadDone = false;
    let lastDownload = 0;

    const cleanup = api.runNetSpeedTest(selectedServerID || undefined, (ev) => {
      // ISP is sent from the ping phase onward; latch it as soon as it arrives.
      if (ev.isp) setIsp(ev.isp);
      if (ev.phase === 'setup') {
        // Narrated pre-test stages (routing switch, server discovery) — keep
        // the pulsing gauge alive with a live label instead of a frozen one.
        setPhase('ping');
        if (ev.message) setGaugeLabel(ev.message);
        return;
      }
      if (ev.phase === 'ping') {
        setPhase('ping');
        if (ev.ping > 0) {
          setGaugePing(ev.ping);
          setGaugeLabel(wanLabel ? `Measuring ping via ${wanLabel}...` : 'Measuring ping...');
        }
      } else if (ev.phase === 'download') {
        // Ping just finished — lock in ping/jitter cards
        if (!pingDone) {
          pingDone = true;
          setCardPing(ev.ping);
          setCardJitter(ev.jitter);
        }
        setPhase('download');
        setGaugeLabel(wanLabel ? `Testing download via ${wanLabel}...` : 'Testing download...');
        // Capture every event's speed (including the final 0 from done),
        // so the download card never displays 0 Mbps just because the last
        // tick was a phase boundary.
        setGaugeValue(ev.speed);
        if (ev.speed > 0) {
          lastDownload = ev.speed;
        }
      } else if (ev.phase === 'upload') {
        // Download just finished — lock in download card
        if (!downloadDone) {
          downloadDone = true;
          setCardDownload(lastDownload);
        }
        setPhase('upload');
        setGaugeLabel(wanLabel ? `Testing upload via ${wanLabel}...` : 'Testing upload...');
        if (ev.speed > 0) {
          setGaugeValue(ev.speed);
        }
      } else if (ev.phase === 'done' && ev.result) {
        setLastResult(ev.result);
        setCardPing(ev.result.ping);
        setCardJitter(ev.result.jitter);
        setCardDownload(ev.result.download);
        setCardUpload(ev.result.upload);
        setGaugeValue(ev.result.download);
        setGaugeLabel(`${ev.result.server.sponsor} — ${ev.result.server.name}`);
        // Auto tests learn their line from the agent (the current primary)
        setTestedLine(ev.result.wanLabel || wanLabel || null);
        setPhase('done');
        fetchHistory();
        setUplinkRefresh((n) => n + 1);
      } else if (ev.phase === 'error') {
        setPhase('idle');
        setGaugeValue(0);
        setGaugeLabel('Ready');
        toast.error(ev.error || 'Speed test failed');
      }
    }, wan);

    cleanupRef.current = cleanup;
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

  const isRunning = phase !== 'idle' && phase !== 'done';
  const gaugeMax = lastResult
    ? Math.max(lastResult.download, lastResult.upload) * 1.2
    : 100;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Gauge className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">Speed Test</h1>
              <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                Network performance from Raspberry Pi
              </p>
            </div>
          </div>
          <AgentStatus health={health} isConnected={!!health?.routerConnected} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="speedtest">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="speedtest">Speed Test</TabsTrigger>
            <TabsTrigger value="streaming">Streaming</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Speed Test Tab — test stage (focal) + lines rail */}
          <TabsContent value="speedtest" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardContent className="pt-8 pb-6 h-full flex flex-col items-center justify-center gap-6">
                  <SpeedGauge
                    value={gaugeValue}
                    max={gaugeMax}
                    label={gaugeLabel}
                    phase={phase}
                    ping={gaugePing}
                  />
                  <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                    <Button
                      size="lg"
                      onClick={() => startSpeedTest()}
                      disabled={isRunning}
                      className="gap-2 w-full sm:w-auto sm:px-10"
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Run Speed Test
                        </>
                      )}
                    </Button>
                    <Select
                      value={selectedServerID || 'auto'}
                      onValueChange={(v) => setSelectedServerID(v === 'auto' ? '' : v)}
                      disabled={isRunning}
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs text-muted-foreground border-border/60"
                        aria-label="Speed test server"
                      >
                        <SelectValue placeholder="Auto (nearest server)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (nearest server)</SelectItem>
                        {servers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.sponsor} — {s.name}, {s.country} ({s.distance} km)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {serversLoading && (
                      <p className="text-[10px] text-muted-foreground">Loading nearby servers…</p>
                    )}
                  </div>
                  {(testedLine || isp || lastResult) && (
                    <div className="text-xs text-muted-foreground text-center space-y-0.5">
                      {testedLine && (
                        <p>Line: <span className="text-foreground font-medium">{testedLine}</span></p>
                      )}
                      {isp && (
                        <p className="text-[10px]">egress seen as {isp}</p>
                      )}
                      {lastResult && (
                        <p>
                          {lastResult.server.sponsor} ({lastResult.server.name}) — {lastResult.server.distance} km
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <UplinksCard
                onTest={(iface, label) => startSpeedTest(iface, label)}
                allowSetPrimary
                disabled={isRunning}
                refreshToken={uplinkRefresh}
              />
            </div>

            <SpeedResultCards
              ping={cardPing}
              jitter={cardJitter}
              download={cardDownload}
              upload={cardUpload}
              phase={phase}
            />
          </TabsContent>

          {/* Latency Tab */}
          <TabsContent value="latency" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Multi-Target Latency</h2>
                <p className="text-sm text-muted-foreground">
                  TCP connect latency to local and external hosts
                </p>
              </div>
              <Button onClick={runLatencyTest} disabled={latencyLoading} className="gap-2">
                {latencyLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4" />
                    Run Latency Test
                  </>
                )}
              </Button>
            </div>

            <LatencyTable targets={latencyTargets} isLoading={latencyLoading} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Test History</h2>
                <p className="text-sm text-muted-foreground">
                  {history.length} result{history.length !== 1 ? 's' : ''} saved
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                {history.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={clearHistory} className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <SpeedHistoryChart results={history} isLoading={historyLoading} />

            {/* History Table */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Download</TableHead>
                        <TableHead>Upload</TableHead>
                        <TableHead>Ping</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {new Date(r.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-foreground font-medium">{r.wanLabel || r.isp || '—'}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.server.sponsor}
                          </TableCell>
                          <TableCell className="font-mono text-green-500">
                            {r.download.toFixed(1)}
                          </TableCell>
                          <TableCell className="font-mono text-blue-500">
                            {r.upload.toFixed(1)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {r.ping.toFixed(1)} ms
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Streaming Tab */}
          <TabsContent value="streaming" className="space-y-6">
            <StreamingTest lastDownloadFromSpeedTest={lastResult?.download ?? null} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
