'use client';

import { useState } from 'react';
import {
  Wifi,
  Cable,
  Ban,
  Check,
  MoreVertical,
  Gauge,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Clock,
  Globe,
  Zap,
  Power,
  Edit3,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Device } from '@/types';
import { cn, getSignalQuality, formatBandwidth, formatDuration } from '@/lib/utils';

interface DeviceCardProps {
  device: Device;
  onBlock: (mac: string) => Promise<void>;
  onUnblock: (mac: string) => Promise<void>;
  onSetBandwidth: (mac: string) => void;
  onDisconnect?: (mac: string) => Promise<void>;
  onBoost?: (mac: string) => void;
  onRename?: (mac: string, currentName: string) => void;
  onWakeOnLan?: (mac: string) => Promise<void>;
}

export function DeviceCard({
  device,
  onBlock,
  onUnblock,
  onSetBandwidth,
  onDisconnect,
  onBoost,
  onRename,
  onWakeOnLan,
}: DeviceCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  // WiFi devices have signal strength data, or are mobile devices, or have private MACs (typically WiFi)
  const mobileTypes = ['phone', 'tablet', 'mobile'];
  const hasPrivateMAC = device.vendor === 'Private Address';
  // Private MACs are used by phones AND modern laptops on WiFi, so assume WiFi for them
  const isWifi = !!device.signalStrength ||
    mobileTypes.includes(device.deviceType?.toLowerCase() || '') ||
    hasPrivateMAC;
  const isWan = device.interface === 'WAN';
  const isOnline = device.status === 'bound' || device.status === 'dynamic';
  const signalQuality = getSignalQuality(device.signalStrength);

  const handleBlock = async () => {
    setIsLoading(true);
    try {
      await onBlock(device.mac);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    setIsLoading(true);
    try {
      await onUnblock(device.mac);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setIsLoading(true);
    try {
      await onDisconnect(device.mac);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWakeOnLan = async () => {
    if (!onWakeOnLan) return;
    setIsLoading(true);
    try {
      await onWakeOnLan(device.mac);
    } finally {
      setIsLoading(false);
    }
  };

  const SignalIcon = {
    excellent: SignalHigh,
    good: SignalHigh,
    fair: SignalMedium,
    poor: SignalLow,
    unknown: Signal,
  }[signalQuality];

  const signalColor = {
    excellent: 'text-green-500',
    good: 'text-green-400',
    fair: 'text-yellow-500',
    poor: 'text-red-500',
    unknown: 'text-muted-foreground',
  }[signalQuality];

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        device.isBlocked && 'opacity-60 border-destructive/50'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          ) : isWifi ? (
            <Wifi className="h-4 w-4 text-blue-500" />
          ) : (
            <Cable className="h-4 w-4 text-green-500" />
          )}
          <CardTitle className="text-sm font-medium">
            {device.comment || device.hostname || (isWan ? 'Gateway' : device.vendor) || device.ip}
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem
                onClick={() => onRename(device.mac, device.comment || device.hostname || device.vendor || '')}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Rename Device
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onSetBandwidth(device.mac)}>
              <Gauge className="mr-2 h-4 w-4" />
              Set Bandwidth Limit
            </DropdownMenuItem>
            {onBoost && (
              <DropdownMenuItem onClick={() => onBoost(device.mac)}>
                <Zap className="mr-2 h-4 w-4 text-yellow-500" />
                Boost Priority
              </DropdownMenuItem>
            )}
            {isWifi && onDisconnect && (
              <DropdownMenuItem
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                <WifiOff className="mr-2 h-4 w-4" />
                Disconnect WiFi
              </DropdownMenuItem>
            )}
            {onWakeOnLan && !isWifi && (
              <DropdownMenuItem
                onClick={handleWakeOnLan}
                disabled={isLoading}
              >
                <Power className="mr-2 h-4 w-4 text-green-500" />
                Wake on LAN
              </DropdownMenuItem>
            )}
            {device.isBlocked ? (
              <DropdownMenuItem onClick={handleUnblock} disabled={isLoading}>
                <Check className="mr-2 h-4 w-4" />
                Unblock Device
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={handleBlock}
                disabled={isLoading}
                className="text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                Block Device
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {/* Connection type (WiFi/Ethernet) - only show for online devices */}
          {isOnline ? (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Connection</span>
              <div className="flex items-center gap-2">
                {isWifi ? (
                  <>
                    <Wifi className="h-4 w-4 text-blue-500" />
                    <span className="text-blue-500 font-medium">WiFi</span>
                  </>
                ) : (
                  <>
                    <Cable className="h-4 w-4 text-green-500" />
                    <span className="text-green-500 font-medium">Ethernet</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <span className="text-muted-foreground">Offline</span>
            </div>
          )}
          {/* Device type icon */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Device</span>
            <div className="flex items-center gap-2">
              {isWan ? (
                <span className="text-xl" role="img" aria-label="wan">🌐</span>
              ) : device.deviceIcon && device.deviceIcon !== '❓' ? (
                <span className="text-xl" role="img" aria-label={device.deviceType || 'device'}>
                  {device.deviceIcon}
                </span>
              ) : null}
              <span className="text-xs capitalize">{device.deviceType || 'Unknown'}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IP Address</span>
            <span className="font-mono">{device.ip}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAC</span>
            <span className="font-mono text-xs">{device.mac}</span>
          </div>
          {device.vendor && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendor</span>
              <span className="text-xs">{device.vendor}</span>
            </div>
          )}
          {device.interface && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interface</span>
              <span>{device.interface}</span>
            </div>
          )}
          {device.uptimeSeconds > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Connected</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{formatDuration(device.uptimeSeconds)}</span>
              </div>
            </div>
          )}
          {isWifi && device.signalStrength && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal</span>
              <div className="flex items-center gap-1">
                <SignalIcon className={cn('h-4 w-4', signalColor)} />
                <span>{device.signalStrength}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {device.isBlocked && (
              <Badge variant="destructive" className="text-xs">
                Blocked
              </Badge>
            )}
            {device.hasBWLimit && (
              <Badge variant="secondary" className="text-xs">
                {formatBandwidth(device.downloadLimit || '0')} limit
              </Badge>
            )}
            {(device.status === 'bound' || device.status === 'dynamic') && (
              <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                Active
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
