'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Minus } from 'lucide-react';

interface StreamingCalculatorProps {
  downloadSpeed: number | null; // Mbps from last speed test
}

// Common streaming presets for quick reference
const presets = [
  { label: '720p', sizeMb: 900, hours: 1 },
  { label: '1080p', sizeMb: 1800, hours: 1 },
  { label: '1080p Remux', sizeMb: 5000, hours: 1 },
  { label: '4K HDR', sizeMb: 8000, hours: 1 },
  { label: '4K Remux', sizeMb: 15000, hours: 1 },
];

export function StreamingCalculator({ downloadSpeed }: StreamingCalculatorProps) {
  const [fileSize, setFileSize] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  const fileSizeGb = parseFloat(fileSize) || 0;
  const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
  const totalSeconds = totalMinutes * 60;

  // Required speed to stream this file in real-time
  const fileSizeMb = fileSizeGb * 1024;
  const requiredMbps = totalSeconds > 0 ? (fileSizeMb * 8) / totalSeconds : 0;

  // Max file size user can stream given their speed
  const maxFileSizeMb = downloadSpeed && totalSeconds > 0
    ? (downloadSpeed / 8) * totalSeconds
    : null;
  const maxFileSizeGb = maxFileSizeMb ? maxFileSizeMb / 1024 : null;

  const hasInput = fileSizeGb > 0 && totalSeconds > 0;
  const canStream = hasInput && downloadSpeed ? requiredMbps <= downloadSpeed : null;
  const headroom = hasInput && downloadSpeed ? ((downloadSpeed - requiredMbps) / downloadSpeed) * 100 : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculate Streaming Requirement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fileSize">File Size (GB)</Label>
              <Input
                id="fileSize"
                type="number"
                placeholder="e.g. 8"
                min="0"
                step="0.1"
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                placeholder="0"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                type="number"
                placeholder="0"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          {/* Result */}
          {hasInput && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Required speed</span>
                <span className="font-mono font-bold text-lg">{requiredMbps.toFixed(1)} Mbps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Required speed</span>
                <span className="font-mono text-sm">{(requiredMbps / 8).toFixed(2)} MB/s</span>
              </div>
              {downloadSpeed !== null && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Your speed</span>
                    <span className="font-mono text-sm">{downloadSpeed.toFixed(1)} Mbps</span>
                  </div>
                  <div className="border-t pt-3 flex items-center gap-2">
                    {canStream ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        <span className="text-green-500 font-medium">
                          You can stream this comfortably
                          {headroom !== null && headroom > 0 && (
                            <span className="text-muted-foreground font-normal text-sm">
                              {' '}— {headroom.toFixed(0)}% headroom
                            </span>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="text-red-500 font-medium">
                          Not enough bandwidth
                          <span className="text-muted-foreground font-normal text-sm">
                            {' '}— need {(requiredMbps - (downloadSpeed || 0)).toFixed(1)} Mbps more
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Max file size for your speed */}
          {downloadSpeed !== null && totalSeconds > 0 && maxFileSizeGb !== null && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                At your speed ({downloadSpeed.toFixed(1)} Mbps), the max file size you can stream for{' '}
                {hours && parseInt(hours) > 0 ? `${hours}h ` : ''}{minutes && parseInt(minutes) > 0 ? `${minutes}m` : totalMinutes > 0 ? '' : '0m'} is:
              </p>
              <p className="text-2xl font-bold mt-1">
                {maxFileSizeGb >= 1 ? `${maxFileSizeGb.toFixed(1)} GB` : `${maxFileSizeMb!.toFixed(0)} MB`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick reference table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Reference (per hour)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {presets.map((p) => {
              const reqMbps = (p.sizeMb * 8) / (p.hours * 3600);
              const ok = downloadSpeed ? reqMbps <= downloadSpeed : null;
              return (
                <div key={p.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {ok === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {ok === false && <XCircle className="h-4 w-4 text-red-500" />}
                    {ok === null && <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">~{p.sizeMb >= 1024 ? `${(p.sizeMb / 1024).toFixed(0)} GB` : `${p.sizeMb} MB`}/hr</span>
                  </div>
                  <span className="font-mono text-sm">{reqMbps.toFixed(1)} Mbps</span>
                </div>
              );
            })}
          </div>
          {!downloadSpeed && (
            <p className="text-xs text-muted-foreground mt-3">Run a speed test to see which qualities you can stream.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
