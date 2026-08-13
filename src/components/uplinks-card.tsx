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
import type { WANLink } from '@/types';

interface UplinksCardProps {
  /** When provided, each link gets a "Test" button that measures that line. */
  onTest?: (iface: string, label: string) => void;
  /** Offer the "Make primary" action on standby links. */
  allowSetPrimary?: boolean;
  /** Disable actions (e.g. while a speed test is running). */
  disabled?: boolean;
}

export function UplinksCard({ onTest, allowSetPrimary, disabled }: UplinksCardProps) {
  const [links, setLinks] = useState<WANLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<WANLink | null>(null);
  const [switching, setSwitching] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.getWanLinks();
      setLinks(res.links || []);
    } catch {
      // agent unreachable — keep whatever we had
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
    const t = setInterval(fetchLinks, 30000);
    return () => clearInterval(t);
  }, [fetchLinks]);

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
              {l.isp && (
                <div className="text-xs text-muted-foreground truncate">{l.isp}</div>
              )}
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
                      disabled={disabled || down}
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
                      disabled={disabled || down || switching}
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
