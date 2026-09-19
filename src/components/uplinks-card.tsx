'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Play, Crown, RefreshCw, Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { timeAgo } from '@/components/device-detail-dialog';
import type { WANLink, CDNSteering, CDNGroupStatus, CFHealth } from '@/types';

const GROUP_TITLES: Record<string, string> = {
  cloudflare: 'Cloudflare',
  google: 'YouTube · Google',
};

const PROBE_TONE: Record<string, string> = {
  up: 'text-green-500',
  degraded: 'text-amber-500',
  down: 'text-red-500',
};

const PROBE_TEXT: Record<string, string> = {
  degraded: 'congested',
  down: 'unreachable',
};

// The agent reports "degraded" when this line's own CDN probe timed out but
// the line still answered another probe pinned to it — a saturated uplink,
// not an outage. Agents predating that field only send `alive`.
function probeState(p?: CFHealth): 'up' | 'degraded' | 'down' | undefined {
  if (!p) return undefined;
  return p.state ?? (p.alive ? 'up' : 'down');
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
  const [links, setLinks] = useState<WANLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<WANLink | null>(null);
  const [switching, setSwitching] = useState(false);
  const [cdn, setCdn] = useState<CDNSteering | null>(null);
  const [cdnSwitching, setCdnSwitching] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.getWanLinks();
      setLinks(res.links || []);
    } catch {
      // agent unreachable — keep whatever we had
    } finally {
      setLoaded(true);
    }
    api.getCdnSteering().then(setCdn).catch(() => null);
  }, []);

  useEffect(() => {
    fetchLinks();
    const t = setInterval(fetchLinks, 30000);
    return () => clearInterval(t);
  }, [fetchLinks]);

  // Refresh immediately when the parent signals a completed test — the new
  // result should appear on the line's card right away, not on the next poll.
  useEffect(() => {
    if (refreshToken) fetchLinks();
  }, [refreshToken, fetchLinks]);

  const handleCdnSwitch = async (g: CDNGroupStatus, iface: string, name: string) => {
    const isAuto = g.mode !== 'manual';
    if (iface === 'auto' ? isAuto : !isAuto && g.interface === iface) return;
    setCdnSwitching(true);
    try {
      await api.setCdnSteering(iface, g.group);
      const title = GROUP_TITLES[g.group] || g.group;
      toast.success(
        iface === 'auto'
          ? `${title} routing is automatic — healthiest path wins`
          : `${title} pinned to ${name}`
      );
      api.getCdnSteering().then(setCdn).catch(() => null);
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
      toast.success(`${confirmTarget.label || confirmTarget.interface} is now the primary uplink`);
      setConfirmTarget(null);
      // the route change settles within a couple of seconds
      setTimeout(fetchLinks, 3000);
      fetchLinks();
    } catch {
      toast.error('Failed to switch primary uplink');
    } finally {
      setSwitching(false);
    }
  };

  if (loaded && links.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Internet Uplinks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.map((l) => {
          const down = l.status !== 'bound';
          const noInternet = !down && !l.alive;
          const dead = down || noInternet;
          return (
            <div key={l.interface} className="rounded-lg border border-border/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={
                      'h-2 w-2 rounded-full shrink-0 ' +
                      (down || noInternet
                        ? 'bg-red-500'
                        : l.primary
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-blue-500')
                    }
                  />
                  <span className="text-sm font-medium truncate">
                    {l.label || l.interface}
                  </span>
                  <span className="text-xs text-muted-foreground">{l.interface}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {l.alive && l.pingMs ? (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {l.pingMs} ms
                    </span>
                  ) : null}
                  {l.primary ? (
                    <Badge variant="outline" className="text-xs text-green-500 border-green-500 gap-1">
                      <Crown className="h-3 w-3" />
                      Primary
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={
                        'text-xs ' +
                        (down || noInternet
                          ? 'text-red-500 border-red-500'
                          : 'text-blue-400 border-blue-400')
                      }
                    >
                      {down ? 'Down' : noInternet ? 'No internet' : 'Standby'}
                    </Badge>
                  )}
                </div>
              </div>
              {(l.lastDownload ?? 0) > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 tabular-nums">
                  <span className="text-base font-semibold text-green-500 whitespace-nowrap">
                    ↓ {l.lastDownload}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">Mbps</span>
                  </span>
                  <span className="text-base font-semibold text-blue-500 whitespace-nowrap">
                    ↑ {l.lastUpload}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">Mbps</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {l.lastPing ? `${l.lastPing} ms` : ''}
                    {l.lastTestAt && timeAgo(l.lastTestAt) ? ` · ${timeAgo(l.lastTestAt)}` : ''}
                  </span>
                </div>
              ) : (
                !down && (
                  <div className="text-[10px] text-muted-foreground italic">
                    not measured yet — run a test on this line
                  </div>
                )
              )}
              <div className="text-[10px] text-muted-foreground truncate">
                {down
                  ? `no lease (${l.status || 'disconnected'})`
                  : `${l.address || '—'} via ${l.gateway || '—'}`}
              </div>
              {(onTest || allowSetPrimary) && (
                <div className="flex gap-2 pt-1">
                  {onTest && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs"
                      disabled={disabled || dead}
                      onClick={() => onTest(l.interface, l.label || l.interface)}
                    >
                      <Play className="h-3 w-3" />
                      Test this line
                    </Button>
                  )}
                  {allowSetPrimary && !l.primary && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs"
                      disabled={disabled || dead || switching}
                      onClick={() => setConfirmTarget(l)}
                    >
                      {switching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />}
                      Make primary
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {cdn && cdn.groups.some((g) => g.routes > 0) && links.length > 1 && (
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">CDN traffic</span>
              <span className="text-[10px] text-muted-foreground">tap a line to pin it</span>
            </div>
            {cdn.groups.filter((g) => g.routes > 0).map((g) => {
              const isAuto = g.mode !== 'manual';
              return (
                <div key={g.group} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {GROUP_TITLES[g.group] || g.group}
                    </span>
                    <Button
                      size="sm"
                      variant={isAuto ? 'secondary' : 'ghost'}
                      className={
                        'h-6 gap-1.5 px-2 text-[11px] ' +
                        (isAuto ? '' : 'text-muted-foreground')
                      }
                      disabled={disabled || cdnSwitching || isAuto}
                      onClick={() => handleCdnSwitch(g, 'auto', 'Auto')}
                    >
                      <span
                        className={
                          'h-1.5 w-1.5 rounded-full ' +
                          (isAuto ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40')
                        }
                      />
                      Auto
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {links.map((l) => {
                      const dead = l.status !== 'bound' || !l.alive;
                      const carrying = g.interface === l.interface;
                      const pinned = !isAuto && carrying;
                      const probe = g.health?.find((hh) => hh.interface === l.interface);
                      const st = probeState(probe);
                      return (
                        <Button
                          key={l.interface}
                          variant="outline"
                          disabled={disabled || cdnSwitching || dead}
                          title={
                            dead
                              ? 'Line has no internet'
                              : st === 'degraded'
                                ? `This line is up, but the ${GROUP_TITLES[g.group] || g.group} probe is timing out on it — usually congestion, not an outage`
                                : `Pin ${GROUP_TITLES[g.group] || g.group} to ${l.label || l.interface}`
                          }
                          onClick={() => handleCdnSwitch(g, l.interface, l.label || l.interface)}
                          className={
                            'h-auto flex-col items-start gap-0.5 px-2.5 py-1.5 ' +
                            (carrying
                              ? 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
                              : 'border-border/60')
                          }
                        >
                          <span className="flex w-full items-center gap-1.5 text-xs font-medium">
                            {carrying && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500 animate-pulse" />
                            )}
                            <span className="truncate">{l.label || l.interface}</span>
                            {pinned && <Pin className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
                          </span>
                          <span
                            className={
                              'text-[11px] tabular-nums font-normal ' +
                              (st ? PROBE_TONE[st] : 'text-muted-foreground')
                            }
                          >
                            {st === 'up' ? `${probe?.pingMs} ms` : st ? PROBE_TEXT[st] : '—'}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  {isAuto && g.lastAutoReason && (
                    <p className="text-[10px] text-muted-foreground">{g.lastAutoReason}</p>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground">
              Auto escapes a dead path in ~2 min · a pinned line falls back only if it drops entirely
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Failover is automatic (~20–30s) if the primary stops passing traffic.
        </p>
      </CardContent>

      <AlertDialog open={confirmTarget !== null} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {confirmTarget?.label || confirmTarget?.interface} the primary uplink?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All internet traffic will switch to this line within a few seconds. The other
              uplink stays connected as the automatic backup. Active downloads and calls may
              briefly stall during the switch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMakePrimary}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
