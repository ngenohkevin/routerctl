'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square, CheckCircle2, XCircle, ChevronDown, Activity, Trash2, Tv, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StreamingCalculator } from '@/components/streaming-calculator';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Stat, StatStrip } from '@/components/shell/stat';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatMbps, formatMs, gradeMeaning, gradeTone } from '@/lib/speed';
import { useNetwork } from '@/stores/network';
import { toast } from 'sonner';
import type { StreamingTestResult, StreamingCDN, WANLink } from '@/types';

type Phase = 'idle' | 'cdn' | 'idle-latency' | 'download' | 'done' | 'error' | 'cancelled';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'cdn', label: 'Streaming services' },
  { phase: 'idle-latency', label: 'Idle latency' },
  { phase: 'download', label: 'Line under load · 20s' },
];

const GRADE_STYLE = {
  link: 'text-link border-link/35 bg-link/10',
  amber: 'text-amber border-amber/35 bg-amber/10',
  fault: 'text-fault border-fault/40 bg-fault/10',
  ink: 'text-ink-3 border-hairline bg-inset',
} as const;

function GradeBadge({ grade, size = 'lg' }: { grade: string; size?: 'lg' | 'sm' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md border font-semibold',
        size === 'lg' ? 'h-16 min-w-16 px-3 text-3xl rounded-xl' : 'h-6 min-w-8 px-1.5 text-xs',
        GRADE_STYLE[gradeTone(grade)]
      )}
    >
      {grade}
    </span>
  );
}

function cdnTone(ms: number) {
  return ms < 50 ? 'text-link' : ms < 150 ? 'text-amber' : 'text-fault';
}

const lineDead = (l: WANLink) => l.status !== 'bound' || !l.alive;

export function StreamingTest({
  lastDownloadFromSpeedTest,
  blocked = false,
  onRunningChange,
}: {
  lastDownloadFromSpeedTest: number | null;
  /** Another test holds the line; one test at a time. */
  blocked?: boolean;
  onRunningChange?: (running: boolean) => void;
}) {
  const { links } = useNetwork();
  const [phase, setPhase] = useState<Phase>('idle');
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [cdns, setCdns] = useState<StreamingCDN[]>([]);
  const [result, setResult] = useState<StreamingTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StreamingTestResult[]>([]);
  const [wanChoice, setWanChoice] = useState(''); // '' = current routing
  const [showCalculator, setShowCalculator] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const running = phase === 'cdn' || phase === 'idle-latency' || phase === 'download';

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  const fetchHistory = () => {
    api.getStreamingHistory(20).then((res) => setHistory(res.results || [])).catch(() => setHistory([]));
  };

  useEffect(() => {
    fetchHistory();
    return () => cancelRef.current?.(); // a running test stops with the page
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

  function start() {
    if (wanChoice) {
      const chosen = links.find((l) => l.interface === wanChoice);
      if (chosen && lineDead(chosen)) {
        toast.error(`${chosen.label || chosen.interface} has no internet — can't measure it`);
        return;
      }
    }
    cancelRef.current?.();
    setPhase('cdn');
    setLiveSpeed(null);
    setLiveLatency(null);
    setProgress(0);
    setNote(null);
    setCdns([]);
    setResult(null);
    setError(null);

    cancelRef.current = api.runStreamingTest((ev) => {
      switch (ev.phase) {
        case 'cdn':
          if (ev.cdn) setCdns((prev) => [...prev, ev.cdn!]);
          return;
        case 'idle':
          setPhase('idle-latency');
          if (ev.message && ev.message.toLowerCase().includes('unreachable')) setNote(ev.message);
          return;
        case 'download':
          setPhase('download');
          if (ev.speed !== undefined) setLiveSpeed(ev.speed);
          if (ev.progress !== undefined) setProgress(ev.progress);
          return;
        case 'bufferbloat':
          if (ev.latency !== undefined) setLiveLatency(ev.latency);
          return;
        case 'done':
          cancelRef.current = null;
          setPhase('done');
          if (ev.result) setResult(ev.result);
          fetchHistory();
          return;
        case 'error':
          cancelRef.current = null;
          setPhase('error');
          setError(ev.error ?? 'Test failed');
          return;
      }
    }, wanChoice || undefined);
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    setPhase('cancelled');
  }

  const stepIndex = STEPS.findIndex((s) => s.phase === phase);

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Streaming quality" icon={<Tv />} />
        <p className="-mt-1.5 mb-4 max-w-2xl text-sm text-ink-3">
          Checks the streaming services, then fills the line for 20 seconds and watches latency. Bufferbloat — how much
          latency rises while the line is busy — decides whether live 4K and video calls hold up.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {running ? (
            <Button size="lg" variant="outline" onClick={cancel} className="gap-2 border-hairline-strong">
              <Square className="size-3.5 fill-current" />
              Cancel test
            </Button>
          ) : (
            <Button size="lg" onClick={start} disabled={blocked} className="gap-2">
              <Play className="size-4" />
              {result ? 'Run again' : 'Run streaming test'}
            </Button>
          )}
          {links.length > 1 && (
            <Select value={wanChoice || 'auto'} onValueChange={(v) => setWanChoice(v === 'auto' ? '' : v)} disabled={running}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-48" aria-label="Measure via line">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Current routing</SelectItem>
                {links.map((l) => (
                  <SelectItem key={l.interface} value={l.interface} disabled={lineDead(l)}>
                    via {l.label || l.interface}
                    {lineDead(l) ? ' — no internet' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-ink-3" aria-live="polite">
            {blocked && !running
              ? 'A speed test is running — one test at a time.'
              : phase === 'cancelled'
                ? 'Cancelled — nothing was saved'
                : phase === 'error'
                  ? <span className="text-fault">{error}</span>
                  : !running && result?.wanLabel
                    ? `Measured via ${result.wanLabel}`
                    : null}
          </span>
        </div>

        {running && (
          <div className="mt-5 space-y-4 border-t border-hairline-soft pt-4">
            {/* Steps */}
            <ol className="grid grid-cols-3 gap-2">
              {STEPS.map((s, i) => {
                const done = i < stepIndex;
                const now = i === stepIndex;
                const fill = done ? 1 : now ? (s.phase === 'download' ? progress : 0.5) : 0;
                return (
                  <li key={s.phase} className="min-w-0">
                    <div className="h-1 overflow-hidden rounded-full bg-inset">
                      <div
                        className={cn(
                          'h-full origin-left transition-transform duration-150 ease-linear',
                          done ? 'bg-link' : 'bg-link/70',
                          now && s.phase !== 'download' && 'animate-pulse'
                        )}
                        style={{ transform: `scaleX(${fill})` }}
                      />
                    </div>
                    <div className={cn('mt-1.5 truncate text-[11px]', now ? 'text-ink' : done ? 'text-ink-3' : 'text-ink-4')}>
                      {s.label}
                    </div>
                  </li>
                );
              })}
            </ol>

            {phase === 'download' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="eyebrow">Download now</div>
                  <div className="num mt-1 font-mono text-[22px] font-semibold text-ink">
                    {liveSpeed != null ? formatMbps(liveSpeed) : '—'}
                    <span className="ml-1 font-sans text-xs font-normal text-ink-3">Mbps</span>
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Latency under load</div>
                  <div className="num mt-1 font-mono text-[22px] font-semibold text-ink">
                    {liveLatency != null ? formatMs(liveLatency) : '—'}
                    <span className="ml-1 font-sans text-xs font-normal text-ink-3">ms</span>
                  </div>
                </div>
              </div>
            )}

            {cdns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cdns.map((c) => (
                  <span
                    key={c.host}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium',
                      c.reachable ? 'border-hairline text-ink-2' : 'border-fault/35 text-fault'
                    )}
                  >
                    {c.name}
                    <span className={cn('num font-mono', c.reachable ? cdnTone(c.pingMs) : '')}>
                      {c.reachable ? `${c.pingMs.toFixed(0)} ms` : 'unreachable'}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {note && <p className="text-xs text-amber">{note}</p>}
          </div>
        )}
      </Panel>

      {result && (
        <>
          {/* Headline: the bufferbloat grade, then the figures behind it */}
          <Panel tone={gradeTone(result.bufferbloatGrade) === 'fault' ? 'fault' : gradeTone(result.bufferbloatGrade) === 'amber' ? 'amber' : undefined}>
            <div className="flex items-center gap-4">
              <GradeBadge grade={result.bufferbloatGrade} />
              <div className="min-w-0">
                <div className="eyebrow">Bufferbloat</div>
                <div className="mt-0.5 text-base font-medium text-ink">{gradeMeaning(result.bufferbloatGrade)}</div>
                {result.loadedLatency > 0 && (
                  <div className="num mt-0.5 font-mono text-xs text-ink-3">
                    +{formatMs(result.latencyRise)} ms while the line is full
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <StatStrip>
            <Stat
              label="Sustained"
              value={<span className="font-mono">{formatMbps(result.sustainedDownload)}</span>}
              hint={`Mbps · peak ${formatMbps(result.peakDownload)}`}
              tone="link"
            />
            <Stat
              label="Idle latency"
              value={<span className="font-mono">{result.idleLatency > 0 ? formatMs(result.idleLatency) : '—'}</span>}
              hint="ms"
            />
            <Stat
              label="Loaded latency"
              value={<span className="font-mono">{result.loadedLatency > 0 ? formatMs(result.loadedLatency) : '—'}</span>}
              hint={result.worstLatency > 0 ? `ms · p95 ${result.worstLatency.toFixed(0)}` : 'ms'}
            />
            <Stat
              label="Rise"
              value={<span className="font-mono">{result.loadedLatency > 0 ? `+${formatMs(result.latencyRise)}` : '—'}</span>}
              hint={`ms · grade ${result.bufferbloatGrade}`}
              tone={gradeTone(result.bufferbloatGrade)}
            />
          </StatStrip>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-0 md:p-0">
              <PanelHeader title="What will play" icon={<Tv />} className="mb-0 px-4 pt-4 pb-3 md:px-5" />
              <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
                {result.qualities.map((q) => (
                  <li key={q.quality} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                    {q.streamable ? (
                      <CheckCircle2 className="size-4 shrink-0 text-link" />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-fault" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{q.quality}</div>
                      {!q.streamable && <div className="truncate text-xs text-ink-3">{q.reason}</div>}
                    </div>
                    <span className="num shrink-0 font-mono text-xs text-ink-3">{q.requiredMb} Mbps</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="p-0 md:p-0">
              <PanelHeader
                title="Streaming services"
                icon={<Activity />}
                aside="handshake"
                className="mb-0 px-4 pt-4 pb-3 md:px-5"
              />
              <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
                {result.cdns.map((c) => (
                  <li key={c.host} className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{c.name}</div>
                      <div className="truncate font-mono text-xs text-ink-4">{c.host}</div>
                    </div>
                    <span className={cn('num shrink-0 font-mono text-sm', c.reachable ? cdnTone(c.pingMs) : 'text-fault')}>
                      {c.reachable ? `${c.pingMs.toFixed(0)} ms` : 'unreachable'}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}

      {history.length > 0 && (
        <Panel className="p-0 md:p-0">
          <PanelHeader
            title="Recent streaming tests"
            icon={<History />}
            className="mb-0 px-4 pt-4 pb-3 md:px-5"
            aside={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-fault hover:text-fault" onClick={clearHistory}>
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            }
          />
          <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
            {history.map((h) => (
              <li key={h.timestamp} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                <GradeBadge grade={h.bufferbloatGrade} size="sm" />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="text-ink-2">{h.wanLabel ?? 'Current routing'}</div>
                  <div className="text-ink-4">
                    {new Date(h.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="num shrink-0 text-right font-mono text-xs">
                  <div className="text-link">{formatMbps(h.sustainedDownload)} Mbps</div>
                  <div className="text-ink-4">{h.loadedLatency > 0 ? `+${h.latencyRise.toFixed(0)} ms` : '—'}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Quick file calculator */}
      <Panel className="p-0 md:p-0">
        <button
          type="button"
          onClick={() => setShowCalculator((v) => !v)}
          aria-expanded={showCalculator}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-raised/40 md:px-5"
        >
          <div>
            <div className="text-sm font-medium text-ink">Quick file calculator</div>
            <div className="text-xs text-ink-3">Plan downloads or local-media playback (Jellyfin, Real-Debrid)</div>
          </div>
          <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform duration-200', showCalculator && 'rotate-180')} />
        </button>
        {showCalculator && (
          <div className="border-t border-hairline-soft px-4 py-4 md:px-5">
            <StreamingCalculator downloadSpeed={result?.sustainedDownload ?? lastDownloadFromSpeedTest} />
          </div>
        )}
      </Panel>
    </div>
  );
}
