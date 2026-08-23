'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Play, Crown, RefreshCw } from 'lucide-react';
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
import type { WANLink, CDNSteering } from '@/types';

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

  const handleCdnSwitch = async (iface: string, name: string) => {
    if (!cdn) return;
    const isAuto = cdn.mode !== 'manual';
    if (iface === 'auto' ? isAuto : !isAuto && cdn.interface === iface) return;
    setCdnSwitching(true);
    try {
      await api.setCdnSteering(iface);
      toast.success(
        iface === 'auto'
          ? 'CDN routing is automatic — best Cloudflare path wins'
          : `Cloudflare + YouTube pinned to ${name}`
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
        {cdn && cdn.routes > 0 && links.length > 1 && (
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">CDN traffic</span>
              <span className="text-[10px] text-muted-foreground">Cloudflare · YouTube</span>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={cdn.mode !== 'manual' ? 'default' : 'outline'}
                className="h-7 flex-1 px-2 text-xs"
                disabled={disabled || cdnSwitching}
                onClick={() => handleCdnSwitch('auto', 'Auto')}
              >
                Auto
              </Button>
              {links.map((l) => {
                const dead = l.status !== 'bound' || !l.alive;
                const current = cdn.interface === l.interface;
                return (
                  <Button
                    key={l.interface}
                    size="sm"
                    variant={cdn.mode === 'manual' && current ? 'default' : 'outline'}
                    className="h-7 flex-1 px-2 text-xs"
                    disabled={disabled || cdnSwitching || dead}
                    title={dead ? 'Line has no internet' : undefined}
                    onClick={() => handleCdnSwitch(l.interface, l.label || l.interface)}
                  >
                    {cdnSwitching ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        {cdn.mode !== 'manual' && current && (
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                        {l.label || l.interface}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>
            {cdn.health && cdn.health.length > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                Cloudflare:{' '}
                {cdn.health.map((hh, i) => (
                  <span key={hh.interface}>
                    {i > 0 && ' · '}
                    {hh.label || hh.interface}{' '}
                    {hh.alive ? (
                      <span className="text-green-500">{hh.pingMs} ms</span>
                    ) : (
                      <span className="text-red-500">unreachable</span>
                    )}
                  </span>
                ))}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {cdn.mode !== 'manual'
                ? cdn.lastAutoReason
                  ? `auto · last change: ${cdn.lastAutoReason}`
                  : 'auto · healthiest Cloudflare path wins; escapes a dead path in ~2 min'
                : `pinned · ${cdn.active < cdn.routes ? `${cdn.routes - cdn.active}/${cdn.routes} routes on fallback` : 'auto-falls back only if the line drops entirely'}`}
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
