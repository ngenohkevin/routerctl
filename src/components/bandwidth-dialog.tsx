'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { Device } from '@/types';

interface BandwidthDialogProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetLimit: (mac: string, upload: string, download: string) => Promise<void>;
  onRemoveLimit: (mac: string) => Promise<void>;
}

const SPEED_PRESETS = [
  { label: '1 Mbps', value: 1000000 },
  { label: '2 Mbps', value: 2000000 },
  { label: '5 Mbps', value: 5000000 },
  { label: '10 Mbps', value: 10000000 },
  { label: '20 Mbps', value: 20000000 },
  { label: '50 Mbps', value: 50000000 },
];

export function BandwidthDialog({
  device,
  open,
  onOpenChange,
  onSetLimit,
  onRemoveLimit,
}: BandwidthDialogProps) {
  const [downloadSpeed, setDownloadSpeed] = useState(5000000);
  const [uploadSpeed, setUploadSpeed] = useState(5000000);
  const [isLoading, setIsLoading] = useState(false);

  const formatSpeed = (speed: number) => {
    if (speed >= 1000000) {
      return `${(speed / 1000000).toFixed(0)} Mbps`;
    }
    return `${(speed / 1000).toFixed(0)} Kbps`;
  };

  const handleSetLimit = async () => {
    if (!device) return;
    setIsLoading(true);
    try {
      await onSetLimit(device.mac, uploadSpeed.toString(), downloadSpeed.toString());
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLimit = async () => {
    if (!device) return;
    setIsLoading(true);
    try {
      await onRemoveLimit(device.mac);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Bandwidth Limit</DialogTitle>
          <DialogDescription>
            Configure bandwidth limits for {device?.hostname || device?.ip}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Download Limit: {formatSpeed(downloadSpeed)}
              </label>
              <Slider
                value={[downloadSpeed]}
                onValueChange={(value) => setDownloadSpeed(value[0])}
                min={100000}
                max={100000000}
                step={100000}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Upload Limit: {formatSpeed(uploadSpeed)}
              </label>
              <Slider
                value={[uploadSpeed]}
                onValueChange={(value) => setUploadSpeed(value[0])}
                min={100000}
                max={100000000}
                step={100000}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {SPEED_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDownloadSpeed(preset.value);
                    setUploadSpeed(preset.value);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {device?.hasBWLimit && (
            <Button
              variant="destructive"
              onClick={handleRemoveLimit}
              disabled={isLoading}
            >
              Remove Limit
            </Button>
          )}
          <Button onClick={handleSetLimit} disabled={isLoading}>
            {isLoading ? 'Applying...' : 'Apply Limit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
