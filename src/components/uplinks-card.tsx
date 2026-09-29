'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Globe, Play, Crown, RefreshCw, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { timeAgo } from '@/components/device-detail-dialog';
import { Panel, PanelHeader } from '@/components/shell/panel';
import { Led, toneFor, type LedTone } from '@/components/shell/led';
import { useNetwork } from '@/stores/network';
import type { WANLink, CDNGroupStatus, CFHealth, LineState } from '@/types';

const GROUP_TITLES: Record<string, string> = {
  cloudflare: 'Cloudflare',
  google: 'YouTube · Google',
};

const PROBE_TONE: Record<string, string> = {
  up: 'text-ink-3',
  degraded: 'text-amber',
  down: 'text-fault',
};

const PROBE_TEXT: Record<string, string> = {
  degraded: 'congested',
  down: 'unreachable',
};

// "degraded" = this line's own CDN probe timed out but the line still answered
// another probe pinned to it — a saturated uplink, not an outage. Agents
// predating that field only send `alive`.
function probeState(p?: CFHealth): 'up' | 'degraded' | 'down' | undefined {
  if (!p) return undefined;
  return p.state ?? (p.alive ? 'up' : 'down');
}

const LINE_LABEL: Record<LineState, string> = {
  up: 'Healthy',
  degraded: 'Degraded',
  severe: 'Severely degraded',
  down: 'No internet',
};

function lineTone(l: WANLink): LedTone {
  if (l.status !== 'bound' || l.alive === false) return 'fault';
  return l.state ? toneFor(l.state) : 'link';
}

/** Segmented pair of buttons (auto / manual style). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-hairline bg-inset p-0.5" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors duration-150',
              on ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2',
              'disabled:cursor-default'
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface UplinksCardProps {
  /** When provided, each link gets a "Test" button that measures that line. */
  onTest?: (iface: string, label: string) => void;
  /** Offer the "Make primary" action on standby links. */
  allowSetPrimary?: boolean;
  /** Disable actions (e.g. while a speed test is running). */
  disabled?: boolean;
  /** Bump this counter to force an immediate refresh (e.g. when a test finishes). */
  refreshToken?: number;
}

export function UplinksCard({ onTest, allowSetPrimary, disabled, refreshToken }: UplinksCardProps) {
  const { links, failover, cdn, loaded, refresh } = useNetwork();
  const [confirmTarget, setConfirmTarget] = useState<WANLink | null>(null);
  const [switching, setSwitching] = useState(false);
  const [cdnSwitching, setCdnSwitching] = useState(false);
  const [failoverSwitching, setFailoverSwitching] = useState(false);

  // Refresh immediately when the parent signals a completed test.
  useEffect(() => {
    if (refreshToken) refresh();
  }, [refreshToken, refresh]);

  const handleFailoverMode = async (mode: 'auto' | 'manual') => {
    if (!failover || failover.mode === mode) return;
    setFailoverSwitching(true);
    try {
      await api.setWanFailover({ mode });
      toast.success(
        mode === 'auto'
          ? 'Automatic — the house uses whichever line measures better'
          : 'Pinned — the house stays on the current line'
      );
      refresh();
    } catch {
      toast.error('Failed to change failover mode');
    } finally {
      setFailoverSwitching(false);
    }
  };

  const handleCdnSwitch = async (g: CDNGroupStatus, iface: string, name: string) => {
    const isAuto = g.mode !== 'manual';
    if (iface === 'auto' ? isAuto : !isAuto && g.interface === iface) return;
    setCdnSwitching(true);
    try {
      await api.setCdnSteering(iface, g.group);
      const title = GROUP_TITLES[g.group] || g.group;
      toast.success(iface === 'auto' ? `${title} routing is automatic` : `${title} pinned to ${name}`);
      refresh();
    } catch {
      toast.error('Failed to switch CDN routing');
    } finally {
      setCdnSwitching(false);
    }
  };

  const handleMakePrimary = async () => {
    if (!confirmTarget) return;
    setSwitching(true);
    try {
      await api.setPrimaryWan(confirmTarget.interface);
      toast.success(`${confirmTarget.label || confirmTarget.interface} is now the primary line`);
      setConfirmTarget(null);
      refresh();
      // the route change settles within a couple of seconds
      setTimeout(refresh, 3000);
    } catch {
      toast.error('Failed to switch primary line');
    } finally {
      setSwitching(false);
    }
  };

  if (loaded && links.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="Internet lines" icon={<Globe />} />

      <div className="space-y-2.5">
        {links.map((l) => {
          const down = l.status !== 'bound';
          const noInternet = !down && l.alive === false;
          const dead = down || noInternet;
          const tone = lineTone(l);
          const ms = l.medianMs ?? l.pingMs;
          return (
            <div
              key={l.interface}
              className={cn(
                'rounded-lg border p-3',
                tone === 'fault' && l.primary
                  ? 'border-fault/40'
                  : tone === 'amber'
                    ? 'border-amber/35'
                    : l.primary
                      ? 'border-hairline-strong'
                      : 'border-hairline',
                l.primary && 'bg-raised/60'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Led tone={tone} live={l.primary && tone === 'link'} />
                  <span className="truncate text-sm font-medium text-ink">{l.label || l.interface}</span>
                  <span className="text-[11px] text-ink-4">{l.interface}</span>
                </div>
                {l.primary ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-link">
                    <Crown className="size-3" /> Primary
                  </span>
                ) : (
                  <span className={cn('text-[11px] font-medium', dead ? 'text-fault' : 'text-ink-4')}>
                    {down ? 'Down' : noInternet ? 'No internet' : 'Standby'}
                  </span>
                )}
              </div>

              {!dead && (
                <div
                  className={cn(
                    'num mt-1 pl-4 font-mono text-xs',
                    tone === 'fault' ? 'text-fault' : tone === 'amber' ? 'text-amber' : 'text-ink-3'
                  )}
                >
                  {l.state && l.state !== 'up' && <span className="font-sans font-medium">{LINE_LABEL[l.state]} · </span>}
                  {ms ? `${Math.round(ms)} ms` : '—'}
                  {l.lossPct !== undefined ? ` · ${Math.round(l.lossPct)}% loss` : ''}
                </div>
              )}

              {(l.lastDownload ?? 0) > 0 ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pl-4">
                  <span className="num text-[15px] font-semibold text-ink">
                    ↓ {l.lastDownload}
                    <span className="ml-0.5 text-[11px] font-normal text-ink-3">Mbps</span>
                  </span>
                  <span className="num text-[15px] font-semibold text-ink-2">
                    ↑ {l.lastUpload}
                    <span className="ml-0.5 text-[11px] font-normal text-ink-3">Mbps</span>
                  </span>
                  <span className="text-[11px] text-ink-4">
                    tested{l.lastTestAt && timeAgo(l.lastTestAt) ? ` ${timeAgo(l.lastTestAt)}` : ''}
                  </span>
                </div>
              ) : (
                !down && <div className="mt-1.5 pl-4 text-[11px] italic text-ink-4">not speed-tested yet</div>
              )}

              <div className="mt-1 truncate pl-4 font-mono text-[11px] text-ink-4">
                {down ? `no lease (${l.status || 'disconnected'})` : `${l.address || '—'} via ${l.gateway || '—'}`}
              </div>

              {(onTest || (allowSetPrimary && !l.primary)) && (
                <div className="mt-2.5 flex gap-2 pl-4">
                  {onTest && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 px-2.5 text-xs"
                      disabled={disabled || dead}
                      onClick={() => onTest(l.interface, l.label || l.interface)}
                    >
                      <Play className="size-3" />
                      Test this line
                    </Button>
                  )}
                  {allowSetPrimary && !l.primary && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 px-2.5 text-xs"
                      disabled={disabled || dead || switching}
                      onClick={() => setConfirmTarget(l)}
                    >
                      {switching ? <RefreshCw className="size-3 animate-spin" /> : <Crown className="size-3" />}
                      Make primary
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {failover && links.length > 1 && (
        <div className="mt-4 border-t border-hairline-soft pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Primary line</span>
            <Segmented
              value={failover.mode}
              disabled={disabled || failoverSwitching}
              onChange={handleFailoverMode}
              options={[
                { value: 'auto', label: 'Auto', icon: <Led tone={failover.mode === 'auto' ? 'link' : 'off'} className="size-1.5" /> },
                { value: 'manual', label: 'Pinned', icon: <Pin className="size-3" /> },
              ]}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            {failover.mode === 'auto'
              ? 'Uses whichever line measures better. Switches when the other is clearly faster or more reliable for 5 minutes, and at once if a line fails.'
              : 'Pinned by hand — automatic selection is paused. The router still fails over if the line drops entirely.'}
          </p>

          {failover.lines.length > 1 && (
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow pb-1.5 font-medium">Last 5 min</th>
                  <th className="eyebrow pb-1.5 text-right font-medium">Response</th>
                  <th className="eyebrow pb-1.5 text-right font-medium">Loss</th>
                  <th className="eyebrow pb-1.5 text-right font-medium">Speed</th>
                </tr>
              </thead>
              <tbody className="num font-mono">
                {failover.lines.map((l) => (
                  <tr key={l.interface} className="border-t border-hairline-soft">
                    <td className="py-1.5 font-sans">
                      <span className={cn('font-medium', l.primary ? 'text-ink' : 'text-ink-2')}>{l.label || l.interface}</span>
                      {l.primary && <span className="ml-1.5 text-ink-4">in use</span>}
                    </td>
                    <td className={cn('py-1.5 text-right', (l.windowMs ?? 0) >= 250 ? 'text-amber' : 'text-ink-2')}>
                      {l.windowMs ? `${Math.round(l.windowMs)} ms` : '—'}
                    </td>
                    <td className={cn('py-1.5 text-right', l.windowLossPct >= 10 ? 'text-fault' : l.windowLossPct >= 5 ? 'text-amber' : 'text-ink-3')}>
                      {`${Math.round(l.windowLossPct)}%`}
                    </td>
                    <td className="py-1.5 text-right text-ink-2" title={l.capacityAt ? `${l.capacitySource ?? 'measured'} ${timeAgo(l.capacityAt) ?? ''}` : undefined}>
                      {l.capacityMbps ? `${Math.round(l.capacityMbps)} Mbps` : '—'}
                      {l.capacityAt && <span className="ml-1 font-sans text-ink-4">{timeAgo(l.capacityAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {failover.balance && (
            <div className="mt-4 border-t border-hairline-soft pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">Use both lines</span>
                <Segmented
                  value={failover.balance.enabled ? 'on' : 'off'}
                  disabled={disabled || failoverSwitching}
                  onChange={async (v) => {
                    setFailoverSwitching(true);
                    try {
                      await api.setWanBalance(v === 'on');
                      toast.success(v === 'on' ? 'Balancing across both lines' : 'Balancing off — one line at a time');
                      refresh();
                    } catch {
                      toast.error('Failed to change balancing');
                    } finally {
                      setFailoverSwitching(false);
                    }
                  }}
                  options={[
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' },
                  ]}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {failover.balance.enabled && failover.balance.shares
                  ? `New connections: ${Object.entries(failover.balance.shares)
                      .sort()
                      .map(([i, n]) => `${n} in ${failover.balance!.buckets} via ${links.find((l) => l.interface === i)?.label || i}`)
                      .join(', ')}, by measured speed. Calls, Tailscale and steered services stay on their line; an open connection never moves.`
                  : failover.balance.enabled
                    ? 'Starting…'
                    : 'Off — the whole house uses the line in use.'}
              </p>
              {failover.balance.error && <p className="mt-1 text-xs text-fault">{failover.balance.error}</p>}
            </div>
          )}

          {failover.reach && failover.reach.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-ink-3">
              {failover.reach.map((g) => {
                const lineLabel = (i?: string) => links.find((l) => l.interface === i)?.label || i;
                const primary = failover.lines.find((l) => l.primary)?.interface;
                const detour = g.via && primary && g.via !== primary;
                return (
                  <li key={g.group} className={cn(detour && 'text-ink-2')}>
                    <span className="font-medium text-ink-2">{g.label}</span> goes via {lineLabel(g.via)}
                    {' · '}
                    <span className="num font-mono">
                      {Object.entries(g.reachable)
                        .map(([i, pct]) => `${lineLabel(i)} ${pct}%`)
                        .join(' · ')}
                    </span>
                    {detour && <span> — the line in use doesn&apos;t reach it reliably</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {failover.mode === 'auto' && failover.pending && (
            <p className="mt-2 rounded-md border border-air/30 px-2.5 py-2 text-xs text-ink-2">
              <span className="font-medium text-air">
                Switching to {links.find((l) => l.interface === failover.pending!.interface)?.label || failover.pending.interface}
              </span>{' '}
              in ~{Math.max(1, Math.ceil((failover.pending.required - failover.pending.seconds) / 60))} min if it stays ahead: {failover.pending.reason}.
            </p>
          )}
          {failover.lastReason && (
            <p className="mt-1.5 text-xs text-ink-3">
              <span className="font-medium text-ink-2">
                Last switch{failover.lastSwitch && timeAgo(failover.lastSwitch) ? ` ${timeAgo(failover.lastSwitch)}` : ''}:
              </span>{' '}
              {failover.lastReason}
            </p>
          )}
        </div>
      )}

      {cdn && cdn.groups.some((g) => g.routes > 0) && links.length > 1 && (
        <div className="mt-4 space-y-3.5 border-t border-hairline-soft pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-ink">Streaming routes</span>
            <span className="text-[11px] text-ink-4">tap a line to pin</span>
          </div>
          {cdn.groups
            .filter((g) => g.routes > 0)
            .map((g) => {
              const isAuto = g.mode !== 'manual';
              const title = GROUP_TITLES[g.group] || g.group;
              return (
                <div key={g.group} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-3">{title}</span>
                    <button
                      type="button"
                      disabled={disabled || cdnSwitching || isAuto}
                      onClick={() => handleCdnSwitch(g, 'auto', 'Auto')}
                      className={cn(
                        'flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors',
                        isAuto ? 'bg-raised text-ink' : 'text-ink-4 hover:text-ink-2'
                      )}
                    >
                      <Led tone={isAuto ? 'link' : 'off'} className="size-1.5" />
                      Auto
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {links.map((l) => {
                      const dead = l.status !== 'bound' || l.alive === false;
                      const carrying = g.interface === l.interface;
                      const pinned = !isAuto && carrying;
                      const probe = g.health?.find((hh) => hh.interface === l.interface);
                      const st = probeState(probe);
                      return (
                        <button
                          key={l.interface}
                          type="button"
                          disabled={disabled || cdnSwitching || dead}
                          title={
                            dead
                              ? 'Line has no internet'
                              : st === 'degraded'
                                ? `This line is up, but the ${title} probe is timing out on it — usually congestion, not an outage`
                                : `Pin ${title} to ${l.label || l.interface}`
                          }
                          onClick={() => handleCdnSwitch(g, l.interface, l.label || l.interface)}
                          className={cn(
                            'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors disabled:opacity-50',
                            carrying ? 'border-link/40 bg-link/[0.06]' : 'border-hairline hover:bg-raised'
                          )}
                        >
                          <span className="flex w-full items-center gap-1.5 text-xs font-medium text-ink-2">
                            {carrying && <Led tone="link" live className="size-1.5" />}
                            <span className="truncate">{l.label || l.interface}</span>
                            {pinned && <Pin className="ml-auto size-3 shrink-0 text-ink-4" />}
                          </span>
                          <span className={cn('num font-mono text-[11px]', st ? PROBE_TONE[st] : 'text-ink-4')}>
                            {st === 'up' ? `${probe?.pingMs} ms` : st ? PROBE_TEXT[st] : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {isAuto && g.lastAutoReason && <p className="text-[11px] text-ink-4">{g.lastAutoReason}</p>}
                </div>
              );
            })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-ink-4">The router itself fails over in ~20–30s if the primary stops passing traffic.</p>

      <AlertDialog open={confirmTarget !== null} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {confirmTarget?.label || confirmTarget?.interface} the primary line?</AlertDialogTitle>
            <AlertDialogDescription>
              All internet traffic switches to this line within a few seconds, and the other stays connected as the
              backup. Downloads and calls may stall briefly. Choosing a line by hand pins it and pauses automatic
              failover — set Primary line back to Auto to resume it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMakePrimary}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
