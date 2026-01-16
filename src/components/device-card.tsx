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
}

export function DeviceCard({
  device,
  onBlock,
  onUnblock,
  onSetBandwidth,
}: DeviceCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isWifi = device.signalStrength || device.interface?.includes('wlan');
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
          {isWifi ? (
            <Wifi className="h-4 w-4 text-blue-500" />
          ) : (
            <Cable className="h-4 w-4 text-green-500" />
          )}
          <CardTitle className="text-sm font-medium">
            {device.hostname || device.ip}
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            <DropdownMenuItem onClick={() => onSetBandwidth(device.mac)}>
              <Gauge className="mr-2 h-4 w-4" />
              Set Bandwidth Limit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IP Address</span>
            <span className="font-mono">{device.ip}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAC</span>
            <span className="font-mono text-xs">{device.mac}</span>
          </div>
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
            {device.status === 'bound' && (
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
