'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Clock, Gauge } from 'lucide-react';
import { StatStrip } from '@/components/shell/stat';
import { cn } from '@/lib/utils';
import { bufferbloatGrade, formatMbps, formatMs, gradeMeaning, gradeTone, loadedRise } from '@/lib/speed';
import type { SpeedTestState } from '@/hooks/use-speed-test';

type Tone = 'ink' | 'link' | 'amber' | 'fault' | 'air';

const VALUE_TONE: Record<Tone, string> = {
  ink: 'text-ink',
  link: 'text-link',
  amber: 'text-amber',
  fault: 'text-fault',
  air: 'text-air',
};

const BAR_TONE: Record<Tone, string> = {
  ink: 'bg-ink-3',
  link: 'bg-link',
  amber: 'bg-amber',
  fault: 'bg-fault',
  air: 'bg-air',
};

/**
 * One figure in the result strip. While its phase runs it shows the live
 * reading in a quieter ink and a progress bar along the bottom edge; when the
 * phase closes the measured value takes the state colour.
 */
function Cell({
  label,
  icon,
  value,
  unit,
  hint,
  tone,
  live,
  progress,
}: {
  label: string;
  icon: ReactNode;
  value: string | null;
  unit: string;
  hint?: ReactNode;
  tone: Tone;
  /** Showing a live reading, not the result. */
  live: boolean;
  /** 0..1 while this phase runs; null otherwise. */
  progress: number | null;
}) {
  return (
    <div className="relative min-w-0 px-4 py-3.5 md:px-5 md:py-4">
      <div className="eyebrow flex items-center gap-1.5">
        <span className="text-ink-4 [&_svg]:size-3.5">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'num mt-1.5 font-mono text-[22px] font-semibold leading-7 tracking-[-0.01em] transition-colors duration-200',
          value == null ? 'text-ink-4' : live ? 'text-ink-2' : VALUE_TONE[tone]
        )}
      >
        {value ?? '—'}
        {value != null && <span className="ml-1 font-sans text-xs font-normal text-ink-3">{unit}</span>}
      </div>
      <div className="mt-0.5 min-h-4 truncate text-xs text-ink-3">{hint}</div>
      {progress != null && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-inset" aria-hidden>
          <div
            className={cn('h-full origin-left transition-transform duration-150 ease-linear', BAR_TONE[tone])}
            style={{ transform: `scaleX(${Math.min(Math.max(progress, 0), 1)})` }}
          />
        </div>
      )}
    </div>
  );
}

export function SpeedResultCards({ state }: { state: SpeedTestState }) {
  const { phase, status } = state;
  const running = status === 'running';
  const at = (p: typeof phase) => (running && phase === p ? state.progress : null);

  const pingLive = running && phase === 'ping' && state.ping == null;
  const pingValue = state.ping ?? (pingLive && state.live > 0 ? state.live : null);

  const downLive = running && phase === 'download' && state.download == null;
  const downValue = state.download ?? (downLive && state.live > 0 ? state.live : null);

  const upLive = running && phase === 'upload' && state.upload == null;
  const upValue = state.upload ?? (upLive && state.live > 0 ? state.live : null);

  // Latency under load: the live sample while a transfer runs, then the
  // worse of the two phase medians compared with the idle ping.
  const rise = loadedRise(state.ping, state.latencyDown, state.latencyUp);
  const transferring = running && (phase === 'download' || phase === 'upload');
  const loadLive = transferring && state.liveLatency != null;
  const grade = rise != null ? bufferbloatGrade(rise) : null;

  let loadValue: string | null = null;
  let loadHint: ReactNode = 'Latency while the line is full';
  if (loadLive) {
    loadValue = formatMs(state.liveLatency!);
    loadHint = state.ping != null ? `idle ${formatMs(state.ping)} ms` : 'measuring under load';
  } else if (rise != null) {
    loadValue = `+${formatMs(rise)}`;
    loadHint = `${grade} · ${gradeMeaning(grade!)}`;
  }

  const loadedParts = [
    state.latencyDown ? `↓ ${formatMs(state.latencyDown)}` : null,
    state.latencyUp ? `↑ ${formatMs(state.latencyUp)}` : null,
  ].filter(Boolean);

  return (
    <StatStrip>
      <Cell
        label="Download"
        icon={<ArrowDown />}
        value={downValue != null ? formatMbps(downValue) : null}
        unit="Mbps"
        tone="link"
        live={downLive}
        progress={at('download')}
        hint={state.latencyDown ? `${formatMs(state.latencyDown)} ms under load` : downLive ? 'last second' : undefined}
      />
      <Cell
        label="Upload"
        icon={<ArrowUp />}
        value={upValue != null ? formatMbps(upValue) : null}
        unit="Mbps"
        tone="air"
        live={upLive}
        progress={at('upload')}
        hint={state.latencyUp ? `${formatMs(state.latencyUp)} ms under load` : upLive ? 'last second' : undefined}
      />
      <Cell
        label="Ping"
        icon={<Clock />}
        value={pingValue != null ? formatMs(pingValue) : null}
        unit="ms"
        tone="ink"
        live={pingLive}
        progress={at('ping')}
        hint={state.jitter != null ? `jitter ${formatMs(state.jitter)} ms` : pingLive ? 'median so far' : undefined}
      />
      <Cell
        label={loadLive ? 'Latency under load' : 'Bufferbloat'}
        icon={<Gauge />}
        value={loadValue}
        unit="ms"
        tone={grade ? gradeTone(grade) : 'ink'}
        live={loadLive}
        progress={null}
        hint={!loadLive && loadedParts.length > 0 && rise != null ? (
          <span title={loadedParts.join(' · ') + ' ms loaded'}>{loadHint}</span>
        ) : (
          loadHint
        )}
      />
    </StatStrip>
  );
}
