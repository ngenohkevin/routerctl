'use client';

import { Cable, Globe, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Led, toneFor, type LedTone } from '@/components/shell/led';
import type { WANLink, WANFailoverStatus, WiFiRadio, SystemInfo } from '@/types';

interface Verdict {
  headline: string;
  detail: string;
  tone: LedTone;
}

/** One sentence about the internet, then why. The overview's focal point. */
export function verdictFor(links: WANLink[], failover: WANFailoverStatus | null, loaded: boolean): Verdict {
  if (!loaded) return { headline: 'Checking the lines…', detail: '', tone: 'off' };
  if (links.length === 0) return { headline: 'No uplink data', detail: 'The agent is not reporting any internet lines.', tone: 'off' };

  const primary = links.find((l) => l.primary);
  const name = (l?: WANLink) => l?.label || l?.interface || 'the primary line';
  const anyAlive = links.some((l) => l.status === 'bound' && l.alive !== false && l.state !== 'down');
  if (!primary || !anyAlive) {
    return { headline: 'No internet', detail: 'Neither line is reaching the internet.', tone: 'fault' };
  }

  const figures = [
    primary.medianMs ? `${Math.round(primary.medianMs)} ms` : primary.pingMs ? `${Math.round(primary.pingMs)} ms` : null,
    primary.lossPct !== undefined ? `${Math.round(primary.lossPct)}% loss` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // A line that is winning but hasn't yet won long enough to take over.
  const pending = failover?.mode === 'auto' ? failover.pending : undefined;
  const pendingLine = pending ? links.find((l) => l.interface === pending.interface) : undefined;
  const backupNote =
    pending && pendingLine
      ? ` — ${name(pendingLine)} is measuring better, switching in ~${Math.max(1, Math.ceil((pending.required - pending.seconds) / 60))} min`
      : '';

  switch (primary.state) {
    case 'severe':
    case 'down':
      return {
        headline: 'Internet is unusable',
        detail: `${name(primary)} is ${primary.state === 'down' ? 'down' : 'severely degraded'}${figures ? ` (${figures})` : ''}${
          failover?.mode === 'auto' ? ' — switching lines automatically' : ''
        }.`,
        tone: 'fault',
      };
    case 'degraded':
      return { headline: 'Internet is slow', detail: `Via ${name(primary)}${figures ? ` · ${figures}` : ''}${backupNote}.`, tone: 'amber' };
    default:
      return { headline: 'Internet is healthy', detail: `Via ${name(primary)}${figures ? ` · ${figures}` : ''}${backupNote}.`, tone: 'link' };
  }
}

function lineFigure(l: WANLink) {
  if (l.status !== 'bound') return 'no lease';
  if (l.alive === false || l.state === 'down') return 'no internet';
  const ms = l.medianMs ?? l.pingMs;
  const parts = [ms ? `${Math.round(ms)} ms` : null, l.lossPct ? `${Math.round(l.lossPct)}% loss` : null].filter(Boolean);
  return parts.join(' · ') || '—';
}

function lineTone(l: WANLink): LedTone {
  if (l.status !== 'bound' || l.alive === false) return 'fault';
  return l.state ? toneFor(l.state) : 'link';
}

/** An uplink as a node in the path. */
function LineNode({ l }: { l: WANLink }) {
  const tone = lineTone(l);
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5',
        l.primary ? 'border-hairline-strong bg-raised' : 'border-hairline bg-transparent'
      )}
    >
      <Led tone={tone} live={l.primary && tone === 'link'} label={`${l.label || l.interface}: ${l.state ?? 'unknown'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('truncate text-sm font-medium', l.primary ? 'text-ink' : 'text-ink-2')}>
            {l.label || l.interface}
          </span>
          <span className="shrink-0 text-[11px] text-ink-4">{l.primary ? 'primary' : 'standby'}</span>
        </div>
        <div
          className={cn(
            'num font-mono text-xs',
            tone === 'fault' ? 'text-fault' : tone === 'amber' ? 'text-amber' : 'text-ink-3'
          )}
        >
          {lineFigure(l)}
        </div>
      </div>
    </div>
  );
}

/** Horizontal connector between nodes (desktop). Solid = carrying traffic. */
function Wire({ active, tone }: { active: boolean; tone: LedTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-px min-w-6 flex-1',
        active
          ? tone === 'amber'
            ? 'bg-amber/70'
            : tone === 'fault'
              ? 'bg-fault/70'
              : 'bg-link/70'
          : 'border-t border-dashed border-hairline-strong bg-transparent'
      )}
    />
  );
}

interface AccessPoint {
  key: string;
  icon: typeof Wifi;
  title: string;
  figure: string;
  tone: LedTone;
  warn?: string;
}

function accessPoints(radios: WiFiRadio[], wired: number): AccessPoint[] {
  const aps: AccessPoint[] = [...radios]
    .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
    .map((r) => ({
      key: r.interface,
      icon: Wifi,
      title: r.band,
      figure: r.running
        ? `ch ${r.number ?? '—'} · ${r.clients} ${r.clients === 1 ? 'device' : 'devices'}`
        : r.disabled
          ? 'disabled'
          : 'not running',
      tone: r.running ? 'air' : r.disabled ? 'off' : 'fault',
      warn: r.running && r.dfs ? 'Radar channel — radar forces it off, dropping everyone' : undefined,
    }));
  aps.push({
    key: 'wired',
    icon: Cable,
    title: 'Wired',
    figure: `${wired} ${wired === 1 ? 'device' : 'devices'}`,
    tone: wired > 0 ? 'link' : 'off',
  });
  return aps;
}

function AccessNode({ ap }: { ap: AccessPoint }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-hairline px-3 py-2.5">
      <ap.icon className={cn('size-4 shrink-0', ap.tone === 'fault' ? 'text-fault' : ap.tone === 'off' ? 'text-ink-4' : ap.key === 'wired' ? 'text-link' : 'text-air')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink-2">{ap.title}</span>
          {ap.warn && (
            <span title={ap.warn} className="shrink-0 rounded border border-amber/40 px-1 text-[10px] font-medium leading-4 text-amber">
              DFS
            </span>
          )}
        </div>
        <div className={cn('num font-mono text-xs', ap.tone === 'fault' ? 'text-fault' : 'text-ink-3')}>{ap.figure}</div>
      </div>
    </div>
  );
}

function RouterNode({ systemInfo }: { systemInfo: SystemInfo | null }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline-strong bg-raised px-3.5 py-3">
      <svg viewBox="0 0 28 28" className="size-7 shrink-0 text-ink-2" aria-hidden>
        <rect x="1.5" y="8.5" width="25" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7.5" cy="14" r="1.6" fill="var(--link)" />
        <circle cx="12.5" cy="14" r="1.6" fill="var(--air)" />
        <path d="M9 8.5 6 3.5M19 8.5l3-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{systemInfo?.boardName || 'Router'}</div>
        <div className="num truncate font-mono text-xs text-ink-3">
          {systemInfo ? `RouterOS ${systemInfo.version.split(' ')[0]} · CPU ${systemInfo.cpuLoad}` : '—'}
        </div>
      </div>
    </div>
  );
}

/**
 * The house network as a path: internet → lines → router → Wi-Fi bands and
 * wired ports, each lit by its real state. The one element in this app that
 * could only belong to it; replaces the anonymous row of count boxes.
 */
export function NetworkPath({
  links,
  failover,
  radios,
  wiredCount,
  systemInfo,
  loaded,
}: {
  links: WANLink[];
  failover: WANFailoverStatus | null;
  radios: WiFiRadio[];
  wiredCount: number;
  systemInfo: SystemInfo | null;
  loaded: boolean;
}) {
  const verdict = verdictFor(links, failover, loaded);
  const aps = accessPoints(radios, wiredCount);
  const primaryTone = links.find((l) => l.primary) ? lineTone(links.find((l) => l.primary)!) : 'off';

  return (
    <section
      aria-label="Network status"
      className={cn(
        'rounded-2xl border bg-panel',
        verdict.tone === 'fault' ? 'border-fault/40' : verdict.tone === 'amber' ? 'border-amber/35' : 'border-hairline'
      )}
    >
      {/* Verdict — the focal point */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-hairline-soft p-4 md:p-6">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Led tone={verdict.tone} live={verdict.tone === 'link'} className="size-2.5" />
            <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.015em] text-ink md:text-[28px] md:leading-9">
              {verdict.headline}
            </h2>
          </div>
          {verdict.detail && <p className="text-sm text-ink-2">{verdict.detail}</p>}
        </div>
        {failover && (
          <div className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-xs text-ink-3">
            <Led tone={failover.mode === 'auto' ? 'link' : 'off'} className="size-1.5" />
            {failover.mode === 'auto' ? 'Automatic failover' : 'Line pinned by hand'}
          </div>
        )}
      </div>

      {/* The path */}
      <div className="p-4 md:p-6">
        {/* Desktop / tablet: left → right */}
        <div className="hidden items-center md:flex">
          <div className="flex w-[34%] min-w-0 shrink-0 flex-col gap-2">
            <div className="eyebrow mb-0.5 flex items-center gap-1.5">
              <Globe className="size-3.5" /> Internet
            </div>
            {links.map((l) => (
              <div key={l.interface} className="flex items-center">
                <div className="min-w-0 flex-1">
                  <LineNode l={l} />
                </div>
                <Wire active={l.primary} tone={lineTone(l)} />
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 items-center">
            <div className="shrink-0">
              <RouterNode systemInfo={systemInfo} />
            </div>
            <Wire active tone={primaryTone} />
          </div>
          <div className="flex w-[30%] min-w-0 shrink-0 flex-col gap-2">
            <div className="eyebrow mb-0.5">Home</div>
            {aps.map((ap) => (
              <AccessNode key={ap.key} ap={ap} />
            ))}
          </div>
        </div>

        {/* Phone: top → bottom */}
        <div className="space-y-2 md:hidden">
          <div className="eyebrow flex items-center gap-1.5">
            <Globe className="size-3.5" /> Internet
          </div>
          <div className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <LineNode key={l.interface} l={l} />
            ))}
          </div>
          <div aria-hidden className="mx-auto h-4 w-px bg-link/50" />
          <RouterNode systemInfo={systemInfo} />
          <div aria-hidden className="mx-auto h-4 w-px bg-link/50" />
          <div className="grid grid-cols-2 gap-2">
            {aps.map((ap) => (
              <AccessNode key={ap.key} ap={ap} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
