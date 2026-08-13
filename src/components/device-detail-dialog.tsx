'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Device } from '@/types';
import { formatBandwidth, formatDuration, prettyBand, formatByteCount } from '@/lib/utils';

function formatBytesNum(bytes: string | undefined): string {
  if (!bytes) return '—';
  const num = parseInt(bytes, 10);
  if (isNaN(num)) return '—';
  if (num >= 1024 ** 3) return `${(num / 1024 ** 3).toFixed(2)} GB`;
  if (num >= 1024 ** 2) return `${(num / 1024 ** 2).toFixed(1)} MB`;
  if (num >= 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${num} B`;
}

export function timeAgo(iso: string | undefined): string | null {
  if (!iso || iso.startsWith('0001-')) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

interface DeviceDetailDialogProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceDetailDialog({ device, open, onOpenChange }: DeviceDetailDialogProps) {
  if (!device) return null;

  const isOnline = device.status === 'bound' || device.status === 'dynamic';
  const isRandomMAC = device.mac.length > 1 && ['2', '6', 'A', 'E'].includes(device.mac[1].toUpperCase());
  const displayName = device.comment || device.hostname || device.deviceModel || device.vendor || device.ip;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {device.deviceIcon && device.deviceIcon !== '❓' && (
              <span className="text-xl">{device.deviceIcon}</span>
            )}
            <span className="truncate">{displayName}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 pt-1">
            <Badge variant={isOnline ? 'outline' : 'secondary'} className={isOnline ? 'text-green-500 border-green-500' : ''}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            {device.isBlocked && <Badge variant="destructive">Blocked</Badge>}
            {device.isExempt && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500">Exempt</Badge>
            )}
            {device.priority > 0 && device.priority < 8 && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                Priority {device.priority}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Row label="Custom name" value={device.comment} />
          <Row label="Hostname" value={device.hostname} />
          <Row label="Model" value={device.deviceModel} />
          <Row label="Type" value={device.deviceType && device.deviceType !== 'unknown' ? device.deviceType : null} />
          <Row label="Vendor" value={device.vendor} />
          <Row label="IP Address" value={device.ip} mono />
          <Row
            label="MAC"
            value={
              <>
                {device.mac}
                {isRandomMAC && (
                  <span className="block text-[10px] text-muted-foreground font-sans">
                    randomized (private) address — changes per network
                  </span>
                )}
              </>
            }
            mono
          />
          <Row label="Interface" value={device.interface} />
          <Row label="Connected for" value={device.uptimeSeconds > 0 ? formatDuration(device.uptimeSeconds) : null} />
          {!isOnline && <Row label="Last seen" value={timeAgo(device.lastSeen)} />}
          <Row label="Band" value={prettyBand(device.band)} />
          <Row
            label="Signal"
            value={
              device.signalDbm
                ? `${device.signalDbm} dBm`
                : device.signalStrength || null
            }
          />
          <Row
            label="Link rate"
            value={
              device.txMbps || device.rxMbps
                ? `↓ ${device.rxMbps || '—'} / ↑ ${device.txMbps || '—'} Mbps`
                : device.txRate || null
            }
          />
          <Row
            label="WiFi session"
            value={
              (device.wifiDownBytes ?? 0) > 0 || (device.wifiUpBytes ?? 0) > 0
                ? `↓ ${formatByteCount(device.wifiDownBytes)} / ↑ ${formatByteCount(device.wifiUpBytes)} since connecting`
                : null
            }
          />
          <Row label="Total transfer" value={`↓ ${formatBytesNum(device.bytesIn)} / ↑ ${formatBytesNum(device.bytesOut)}`} />
          <Row
            label="Bandwidth limit"
            value={
              device.hasBWLimit && !device.isExempt
                ? device.isDefaultLimit
                  ? 'Default limit'
                  : `↓ ${formatBandwidth(device.downloadLimit || '0')} / ↑ ${formatBandwidth(device.uploadLimit || '0')}`
                : null
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
