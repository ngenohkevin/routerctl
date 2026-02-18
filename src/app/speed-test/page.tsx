'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gauge, ArrowLeft, RefreshCw, Play, Trash2, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentStatus } from '@/components/agent-status';
import { SpeedGauge } from '@/components/speed-gauge';
import { SpeedResultCards } from '@/components/speed-result-cards';
import { LatencyTable } from '@/components/latency-table';
import { SpeedHistoryChart } from '@/components/speed-history-chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { HealthStatus, NetSpeedTestResult, LatencyTarget } from '@/types';

type SpeedPhase = 'idle' | 'ping' | 'download' | 'upload' | 'done';

export default function SpeedTestPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Speed test state
  const [phase, setPhase] = useState<SpeedPhase>('idle');
  const [gaugeValue, setGaugeValue] = useState(0);
  const [gaugeLabel, setGaugeLabel] = useState('Ready');
  const [lastResult, setLastResult] = useState<NetSpeedTestResult | null>(null);

  // Latency state
  const [latencyTargets, setLatencyTargets] = useState<LatencyTarget[]>([]);
  const [latencyLoading, setLatencyLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<NetSpeedTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => null);
    fetchHistory();
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
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

  const startSpeedTest = async () => {
    if (phase !== 'idle' && phase !== 'done') return;

    setLastResult(null);
    setGaugeValue(0);

    // Animate through phases while waiting for the blocking POST
    setPhase('ping');
    setGaugeLabel('Measuring ping...');

    // Simulate gauge movement during test
    let tick = 0;
    animationRef.current = setInterval(() => {
      tick++;
      if (tick < 15) {
        // Ping phase (0-3s)
        setGaugeValue(0);
      } else if (tick < 75) {
        // Download phase (3-15s)
        setPhase('download');
        setGaugeLabel('Testing download...');
        // Gradually increase gauge to simulate download speed appearing
        setGaugeValue((prev) => {
          const target = 20 + Math.random() * 30;
          return prev + (target - prev) * 0.1;
        });
      } else {
        // Upload phase (15-30s)
        setPhase('upload');
        setGaugeLabel('Testing upload...');
        setGaugeValue((prev) => {
          const target = 10 + Math.random() * 20;
          return prev + (target - prev) * 0.1;
        });
      }
    }, 200);

    try {
      const res = await api.runNetSpeedTest();
      // Clear animation
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }

      setLastResult(res.result);
      setGaugeValue(res.result.download);
      setGaugeLabel(`${res.result.server.sponsor} — ${res.result.server.name}`);
      setPhase('done');

      // Refresh history
      fetchHistory();
    } catch (error) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      setPhase('idle');
      setGaugeValue(0);
      setGaugeLabel('Ready');
      toast.error(error instanceof Error ? error.message : 'Speed test failed');
    }
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="speedtest">Speed Test</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Speed Test Tab */}
          <TabsContent value="speedtest" className="space-y-6">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center gap-4">
                <SpeedGauge
                  value={gaugeValue}
                  max={gaugeMax}
                  label={gaugeLabel}
                  phase={phase}
                />
                <Button
                  size="lg"
                  onClick={startSpeedTest}
                  disabled={isRunning}
                  className="gap-2"
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
                {lastResult && (
                  <p className="text-xs text-muted-foreground">
                    Server: {lastResult.server.sponsor} ({lastResult.server.name}, {lastResult.server.country})
                    — {lastResult.server.distance} km away
                  </p>
                )}
              </CardContent>
            </Card>

            <SpeedResultCards result={lastResult} />
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
        </Tabs>
      </div>
    </div>
  );
}
