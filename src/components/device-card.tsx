'use client';

import { useState, type ReactNode } from 'react';
import {
  Ban,
  Cable,
  Check,
  Edit3,
  Gamepad2,
  Gauge,
  Laptop,
  Monitor,
  MoreHorizontal,
  Power,
  Printer,
  Router as RouterIcon,
  Shield,
  ShieldOff,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Watch,
  WifiOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { Device } from '@/types';
import { cn, formatBandwidth, formatDuration, prettyBand } from '@/lib/utils';
import { timeAgo } from '@/components/device-detail-dialog';

// Randomized/private MACs (2nd hex digit 2, 6, A or E) are phones and laptops on Wi-Fi.
function hasRandomizedMAC(mac: string): boolean {
  if (mac.length < 2) return false;
  const c = mac[1].toUpperCase();
  return c === '2' || c === '6' || c === 'A' || c === 'E';
}

function formatRate(rate: string | undefined): string | null {
  const n = parseInt(rate || '0', 10);
  if (!n) return null;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB/s`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB/s`;
  return `${n} B/s`;
}

/** Device glyph from its detected type — a drawn icon, not an emoji. */
function glyphFor(d: Device): LucideIcon {
  const t = `${d.deviceType || ''} ${d.deviceModel || ''}`.toLowerCase();
  if (d.wanSide) return RouterIcon;
  if (/(tv|roku|chromecast|fire ?stick|apple tv|box)/.test(t)) return Tv;
  if (/(watch)/.test(t)) return Watch;
  if (/(tablet|ipad)/.test(t)) return Tablet;
  if (/(phone|mobile|android|iphone|galaxy|pixel)/.test(t)) return Smartphone;
  if (/(laptop|macbook|notebook|computer|pc|desktop|imac|mac)/.test(t)) return Laptop;
  if (/(printer)/.test(t)) return Printer;
  if (/(speaker|sonos|echo|homepod|audio)/.test(t)) return Speaker;
  if (/(console|playstation|xbox|nintendo|switch)/.test(t)) return Gamepad2;
  if (/(router|access point|ap|raspberry|server)/.test(t)) return RouterIcon;
  return Monitor;
}

function signalBars(dbm?: number): { n: number; tone: string } {
  if (dbm === undefined || dbm === null) return { n: 0, tone: 'bg-ink-4' };
  if (dbm >= -55) return { n: 4, tone: 'bg-link' };
  if (dbm >= -65) return { n: 3, tone: 'bg-link' };
  if (dbm >= -72) return { n: 2, tone: 'bg-amber' };
  return { n: 1, tone: 'bg-fault' };
}

interface DeviceCardProps {
  device: Device;
  onBlock: (mac: string) => Promise<void>;
  onUnblock: (mac: string) => Promise<void>;
  onSetBandwidth: (mac: string) => void;
  onDisconnect?: (mac: string) => Promise<void>;
  onBoost?: (mac: string) => void;
  onRename?: (mac: string, currentName: string) => void;
  onWakeOnLan?: (mac: string) => Promise<void>;
  onExempt?: (mac: string) => Promise<void>;
  onRemoveExemption?: (mac: string) => Promise<void>;
  onShowDetails?: (mac: string) => void;
}

/**
 * One device. Leads with who it is and whether it's moving data; everything
 * else (MAC, vendor, totals) lives in the detail dialog one tap away.
 */
export function DeviceCard({
  device,
  onBlock,
  onUnblock,
  onSetBandwidth,
  onDisconnect,
  onBoost,
  onRename,
  onWakeOnLan,
  onExempt,
  onRemoveExemption,
  onShowDetails,
}: DeviceCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'disconnect' | null>(null);

  const mobileTypes = ['phone', 'tablet', 'mobile', 'watch', 'apple', 'android'];
  const isWifi =
    !!device.signalStrength ||
    mobileTypes.includes(device.deviceType?.toLowerCase() || '') ||
    hasRandomizedMAC(device.mac);
  const isWan = device.wanSide || device.interface === 'WAN';
  const isOnline = device.status === 'bound' || device.status === 'dynamic';
  const name =
    device.comment || device.hostname || (isWan ? 'Gateway' : device.deviceModel || device.vendor) || device.ip;
  const kind = [device.deviceModel && device.deviceModel !== name ? device.deviceModel : device.deviceType, device.vendor]
    .filter((v, i, a) => v && a.indexOf(v) === i && v !== name)
    .join(' · ');
  const Glyph = glyphFor(device);
  const down = formatRate(device.rateIn);
  const up = formatRate(device.rateOut);
  const active = !!(down || up);
  const bars = signalBars(device.signalDbm);
  const band = prettyBand(device.band);
  const hasPriority = device.priority > 0 && device.priority < 8;

  const run = async (fn: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await fn();
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = onShowDetails ? () => onShowDetails(device.mac) : undefined;

  return (
    <article
      className={cn(
        'group relative flex min-w-0 flex-col rounded-xl border bg-panel p-4 transition-colors duration-150',
        device.isBlocked ? 'border-fault/35' : 'border-hairline',
        openDetails && 'hover:border-hairline-strong',
        !isOnline && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-raised',
            device.isBlocked ? 'text-fault' : isOnline ? 'text-ink-2' : 'text-ink-4'
          )}
        >
          <Glyph className="size-[18px]" />
        </span>
        <button
          type="button"
          onClick={openDetails}
          disabled={!openDetails}
          className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-[''] disabled:after:hidden"
          aria-label={`Details for ${name}`}
        >
          <div className="truncate text-[15px] font-medium leading-5 text-ink">{name}</div>
          <div className="mt-0.5 truncate text-xs text-ink-3">{kind || (isWan ? 'Upstream gateway' : 'Unknown device')}</div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative z-10 -mr-1.5 -mt-1 size-9 text-ink-3" aria-label={`Actions for ${name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onRename && (
              <DropdownMenuItem
                onClick={() => onRename(device.mac, device.comment || device.hostname || device.deviceModel || device.vendor || '')}
              >
                <Edit3 className="size-4" /> Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onSetBandwidth(device.mac)}>
              <Gauge className="size-4" /> Bandwidth limit
            </DropdownMenuItem>
            {device.isExempt && onRemoveExemption ? (
              <DropdownMenuItem onClick={() => onRemoveExemption(device.mac)}>
                <ShieldOff className="size-4" /> Remove exemption
              </DropdownMenuItem>
            ) : !device.isExempt && onExempt ? (
              <DropdownMenuItem onClick={() => onExempt(device.mac)}>
                <Shield className="size-4" /> Exempt from default limit
              </DropdownMenuItem>
            ) : null}
            {onBoost && (
              <DropdownMenuItem onClick={() => onBoost(device.mac)}>
                <Zap className="size-4" /> {hasPriority ? `Priority ${device.priority}/8` : 'Boost priority'}
              </DropdownMenuItem>
            )}
            {isWifi && onDisconnect && (
              <DropdownMenuItem onClick={() => setConfirmAction('disconnect')} disabled={isLoading}>
                <WifiOff className="size-4" /> Disconnect from Wi-Fi
              </DropdownMenuItem>
            )}
            {onWakeOnLan && !isWifi && (
              <DropdownMenuItem onClick={() => onWakeOnLan && run(() => onWakeOnLan(device.mac))} disabled={isLoading}>
                <Power className="size-4" /> Wake on LAN
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {device.isBlocked ? (
              <DropdownMenuItem onClick={() => run(() => onUnblock(device.mac))} disabled={isLoading}>
                <Check className="size-4" /> Unblock
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setConfirmAction('block')} disabled={isLoading} variant="destructive">
                <Ban className="size-4" /> Block
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Address + link */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="num truncate font-mono text-[13px] text-ink-2">{device.ip}</span>
        {isOnline ? (
          isWifi ? (
            <span className="flex shrink-0 items-center gap-1.5" title={device.signalDbm ? `${device.signalDbm} dBm` : 'Wi-Fi'}>
              {device.signalDbm !== undefined && device.signalDbm !== null && (
                <span className={cn('num font-mono text-xs', bars.n <= 1 ? 'text-fault' : bars.n === 2 ? 'text-amber' : 'text-ink-3')}>
                  {device.signalDbm} dBm
                </span>
              )}
              <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn('w-[3px] rounded-[1px]', i <= bars.n ? bars.tone : 'bg-hairline-strong')}
                    style={{ height: `${i * 25}%` }}
                  />
                ))}
              </span>
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
              <Cable className="size-3.5 text-link" /> Wired
            </span>
          )
        ) : (
          <span className="shrink-0 text-xs text-ink-4">
            {timeAgo(device.lastSeen) ? `seen ${timeAgo(device.lastSeen)}` : 'offline'}
          </span>
        )}
      </div>

      {/* Live traffic — only when it's moving */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {active ? (
          <>
            <span className="num font-mono text-ink">↓ {down ?? '0 B/s'}</span>
            <span className="num font-mono text-ink-3">↑ {up ?? '0 B/s'}</span>
          </>
        ) : (
          <span className="text-ink-4">
            {isOnline ? (device.uptimeSeconds > 0 ? `idle · online ${formatDuration(device.uptimeSeconds)}` : 'idle') : 'not connected'}
          </span>
        )}
      </div>

      {/* State chips */}
      {(device.isBlocked || device.isExempt || hasPriority || device.hasBWLimit || (isOnline && isWifi && band)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {device.isBlocked && <Chip tone="fault">Blocked</Chip>}
          {isOnline && isWifi && band && <Chip tone="air">{band}</Chip>}
          {hasPriority && (
            <Chip tone="amber">
              <Zap className="size-3" /> Priority {device.priority}
            </Chip>
          )}
          {device.isExempt && <Chip tone="link">Exempt</Chip>}
          {device.hasBWLimit && !device.isExempt && (
            <Chip>{device.isDefaultLimit ? 'Default limit' : `${formatBandwidth(device.downloadLimit || '0')} limit`}</Chip>
          )}
        </div>
      )}

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === 'block' ? `Block ${name}?` : `Disconnect ${name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'block'
                ? 'It loses all network access until you unblock it.'
                : 'It is kicked off Wi-Fi and can reconnect straight away unless you also block it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction === 'block' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'block') void run(() => onBlock(device.mac));
                else if (action === 'disconnect' && onDisconnect) void run(() => onDisconnect(device.mac));
              }}
            >
              {confirmAction === 'block' ? 'Block' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'fault' | 'air' | 'amber' | 'link' }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium',
        tone === 'fault'
          ? 'border-fault/35 text-fault'
          : tone === 'air'
            ? 'border-air/30 text-air'
            : tone === 'amber'
              ? 'border-amber/35 text-amber'
              : tone === 'link'
                ? 'border-link/35 text-link'
                : 'border-hairline-strong text-ink-3'
      )}
    >
      {children}
    </span>
  );
}
