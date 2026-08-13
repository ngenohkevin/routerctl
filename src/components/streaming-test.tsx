'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp, Activity, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StreamingCalculator } from '@/components/streaming-calculator';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { StreamingTestResult, StreamingCDN, WANLink } from '@/types';

type Phase = 'idle' | 'cdn' | 'idle-latency' | 'download' | 'bufferbloat' | 'done' | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  cdn: 'Probing streaming CDNs…',
  'idle-latency': 'Measuring idle latency…',
  download: 'Saturating link for 20s…',
  bufferbloat: 'Saturating link for 20s…',
  done: 'Done',
  error: 'Error',
};

// Grade colour scale — A+/A green, B/C amber, D/F red. Used for both the
// big badge and the per-quality table icons.
function gradeColour(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10';
  if (grade === 'B') return 'text-lime-500 border-lime-500/50 bg-lime-500/10';
  if (grade === 'C') return 'text-amber-500 border-amber-500/50 bg-amber-500/10';
  if (grade === 'D') return 'text-orange-500 border-orange-500/50 bg-orange-500/10';
  if (grade === 'F') return 'text-red-500 border-red-500/50 bg-red-500/10';
  return 'text-muted-foreground border-muted bg-muted/30';
}

function gradeDescription(grade: string): string {
  switch (grade) {
    case 'A+': return 'Excellent — imperceptible under load';
    case 'A':  return 'Great — minimal latency rise';
    case 'B':  return 'Good — fine for most streaming';
    case 'C':  return 'Fair — 4K live may stutter';
    case 'D':  return 'Poor — video calls and live 4K will struggle';
    case 'F':  return 'Severe — most live content unwatchable';
    default:   return 'Bufferbloat target unreachable';
  }
}

export function StreamingTest({ lastDownloadFromSpeedTest }: { lastDownloadFromSpeedTest: number | null }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [progressCDNs, setProgressCDNs] = useState<StreamingCDN[]>([]);
  const [result, setResult] = useState<StreamingTestResult | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StreamingTestResult[]>([]);
  const [wanLinks, setWanLinks] = useState<WANLink[]>([]);
  const [wanChoice, setWanChoice] = useState<string>(''); // '' = current routing
  const cancelRef = useRef<(() => void) | null>(null);

  const isRunning = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  const fetchHistory = () => {
    api.getStreamingHistory(20).then((res) => setHistory(res.results || [])).catch(() => setHistory([]));
  };

  useEffect(() => {
    fetchHistory();
    api.getWanLinks().then((res) => setWanLinks(res.links || [])).catch(() => setWanLinks([]));
  }, []);

  const clearHistory = async () => {
    try {
      await api.clearStreamingHistory();
      setHistory([]);
      toast.success('Streaming history cleared');
    } catch {
      toast.error('Failed to clear streaming history');
    }
  };

  function startTest() {
    cancelRef.current?.();
    setPhase('cdn');
    setLiveSpeed(null);
    setLiveLatency(null);
    setProgressCDNs([]);
    setResult(null);
    setError(null);

    cancelRef.current = api.runStreamingTest((ev) => {
      if (ev.phase === 'cdn' && ev.cdn) {
        setProgressCDNs((prev) => [...prev, ev.cdn!]);
        return;
      }
      if (ev.phase === 'idle') {
        // Backend's "idle" phase clashes with our "idle-latency" UI label;
        // remap for clarity.
        setPhase('idle-latency');
        return;
      }
      if (ev.phase === 'download') {
        setPhase('download');
        if (ev.speed !== undefined) setLiveSpeed(ev.speed);
        return;
      }
      if (ev.phase === 'bufferbloat') {
        if (ev.latency !== undefined) setLiveLatency(ev.latency);
        return;
      }
      if (ev.phase === 'done') {
        setPhase('done');
        if (ev.result) setResult(ev.result);
        fetchHistory();
        return;
      }
      if (ev.phase === 'error') {
        setPhase('error');
        setError(ev.error ?? 'Test failed');
        return;
      }
    }, wanChoice || undefined);
  }

  return (
    <div className="space-y-6">
      {/* Header card — Run Test button + phase indicator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Streaming Quality Test</CardTitle>
          <CardDescription>
            Probes CDN reachability, saturates the link, and measures bufferbloat — the metric that decides whether
            live 4K and video calls actually work on your connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button size="lg" onClick={startTest} disabled={isRunning} className="gap-2">
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Running…' : 'Run Streaming Test'}
            </Button>
            {wanLinks.length > 1 && (
              <Select
                value={wanChoice || 'auto'}
                onValueChange={(v) => setWanChoice(v === 'auto' ? '' : v)}
                disabled={isRunning}
              >
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs" aria-label="Measure via line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Current routing</SelectItem>
                  {wanLinks.map((l) => (
                    <SelectItem key={l.interface} value={l.interface}>
                      via {l.label || l.interface}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isRunning && <span className="text-sm text-muted-foreground">{PHASE_LABEL[phase]}</span>}
            {!isRunning && result?.wanLabel && (
              <span className="text-xs text-muted-foreground">measured via {result.wanLabel}</span>
            )}
            {phase === 'error' && error && (
              <span className="text-sm text-destructive">Error: {error}</span>
            )}
          </div>

          {/* Live progress: download speed + bufferbloat sample */}
          {(phase === 'download' || phase === 'bufferbloat') && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Live download</div>
                <div className="text-2xl font-mono font-semibold">
                  {liveSpeed !== null ? `${liveSpeed.toFixed(1)} Mbps` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Latency under load</div>
                <div className="text-2xl font-mono font-semibold">
                  {liveLatency !== null ? `${liveLatency.toFixed(0)} ms` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* CDN probes complete in parallel — show them filling in */}
          {progressCDNs.length > 0 && !result && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {progressCDNs.map((c) => (
                <Badge
                  key={c.host}
                  variant="outline"
                  className={c.reachable ? 'text-emerald-500 border-emerald-500/40' : 'text-destructive border-destructive/40'}
                >
                  {c.name}: {c.reachable ? `${c.pingMs.toFixed(0)} ms` : 'unreachable'}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Headline: bufferbloat grade */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="flex flex-col items-center md:items-start">
                  <div className="text-sm text-muted-foreground mb-1">Bufferbloat</div>
                  <div className={`inline-flex items-center justify-center min-w-20 h-20 rounded-xl border-2 text-4xl font-bold ${gradeColour(result.bufferbloatGrade)}`}>
                    {result.bufferbloatGrade}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{gradeDescription(result.bufferbloatGrade)}</p>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <Stat label="Sustained download" value={`${result.sustainedDownload.toFixed(1)} Mbps`} hint={`peak ${result.peakDownload.toFixed(1)}`} />
                  <Stat label="Idle latency" value={result.idleLatency > 0 ? `${result.idleLatency.toFixed(1)} ms` : '—'} />
                  <Stat label="Loaded latency" value={result.loadedLatency > 0 ? `${result.loadedLatency.toFixed(1)} ms` : '—'} hint={result.worstLatency > 0 ? `p95 ${result.worstLatency.toFixed(0)}` : undefined} />
                  <Stat
                    label="Latency rise"
                    value={result.latencyRise > 0 ? `+${result.latencyRise.toFixed(1)} ms` : '—'}
                    hint={result.bufferbloatGrade !== '—' ? `grade ${result.bufferbloatGrade}` : undefined}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-CDN reachability */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                CDN reachability
              </CardTitle>
              <CardDescription>TCP-handshake latency to each streaming service. Lower = better peering with your ISP.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.cdns.map((c) => (
                    <TableRow key={c.host}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.host}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.reachable ? (
                          <span className={c.pingMs < 50 ? 'text-emerald-500' : c.pingMs < 150 ? 'text-amber-500' : 'text-destructive'}>
                            {c.pingMs.toFixed(0)} ms
                          </span>
                        ) : (
                          <span className="text-destructive">unreachable</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-quality verdict */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quality verdict</CardTitle>
              <CardDescription>
                Based on your sustained throughput AND bufferbloat. A fast link with poor bufferbloat still fails
                high-tier live streams.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead>Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.qualities.map((q) => (
                    <TableRow key={q.quality}>
                      <TableCell className="w-8">
                        {q.streamable ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{q.quality}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{q.requiredMb} Mbps</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.streamable ? 'Comfortable' : q.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recent streaming tests — persisted history */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent tests</CardTitle>
              <CardDescription>{history.length} saved — bufferbloat grade and sustained speed over time</CardDescription>
            </div>
            <Button variant="destructive" size="sm" className="gap-1" onClick={clearHistory}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Sustained</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Latency rise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.timestamp}>
                    <TableCell className="text-xs">
                      {new Date(h.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center justify-center min-w-8 h-6 px-1.5 rounded border text-xs font-bold ${gradeColour(h.bufferbloatGrade)}`}>
                        {h.bufferbloatGrade}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{h.sustainedDownload.toFixed(1)} Mbps</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                      {h.latencyRise > 0 ? `+${h.latencyRise.toFixed(0)} ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Collapsible quick calculator — preserved from the old tab */}
      <Card>
        <button
          type="button"
          onClick={() => setShowCalculator((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div>
            <div className="text-sm font-medium">Quick file calculator</div>
            <div className="text-xs text-muted-foreground">Plan downloads or local-media playback (Jellyfin, Real-Debrid)</div>
          </div>
          {showCalculator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showCalculator && (
          <CardContent>
            <StreamingCalculator downloadSpeed={result?.sustainedDownload ?? lastDownloadFromSpeedTest} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
