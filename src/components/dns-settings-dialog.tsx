'use client';

import { useState, useEffect } from 'react';
import { Globe, Loader2, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { DnsSettings } from '@/types';

interface DnsSettingsDialogProps {
  currentSettings: DnsSettings | null;
  onSave: (servers: string[], allowRemoteRequests: boolean) => Promise<void>;
  disabled?: boolean;
}

const DNS_PRESETS = [
  { name: 'Pi-hole', primary: '10.10.10.101', secondary: '1.1.1.1' },
  { name: 'Google', primary: '8.8.8.8', secondary: '8.8.4.4' },
  { name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1' },
  { name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220' },
  { name: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112' },
  { name: 'AdGuard', primary: '94.140.14.14', secondary: '94.140.15.15' },
];

export function DnsSettingsDialog({
  currentSettings,
  onSave,
  disabled,
}: DnsSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [servers, setServers] = useState<string[]>(['', '']);
  const [allowRemoteRequests, setAllowRemoteRequests] = useState(false);

  // Initialize form when dialog opens or settings change
  useEffect(() => {
    if (currentSettings && open) {
      const currentServers = currentSettings.servers ?? [];
      setServers([
        currentServers[0] ?? '',
        currentServers[1] ?? '',
      ]);
      setAllowRemoteRequests(currentSettings.allowRemoteRequests ?? false);
    }
  }, [currentSettings, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty servers
    const validServers = servers.filter((s) => s.trim() !== '');
    if (validServers.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(validServers, allowRemoteRequests);
      setOpen(false);
    } catch (error) {
      // Error handling done in parent
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (preset: typeof DNS_PRESETS[0]) => {
    setServers([preset.primary, preset.secondary]);
  };

  const updateServer = (index: number, value: string) => {
    const newServers = [...servers];
    newServers[index] = value;
    setServers(newServers);
  };

  const isValidIp = (ip: string) => {
    if (!ip) return true; // Empty is ok
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
  };

  const hasValidServers = servers.some((s) => s.trim() !== '' && isValidIp(s));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Globe className="h-4 w-4 mr-2" />
          Configure DNS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              DNS Server Settings
            </DialogTitle>
            <DialogDescription>
              Configure which DNS servers your router uses for name resolution.
              Changes will affect all devices on the network.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Quick Presets */}
            <div className="grid gap-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {DNS_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="text-xs"
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Primary DNS */}
            <div className="grid gap-2">
              <Label htmlFor="primary-dns">Primary DNS Server</Label>
              <Input
                id="primary-dns"
                placeholder="e.g., 8.8.8.8"
                value={servers[0]}
                onChange={(e) => updateServer(0, e.target.value)}
                className={!isValidIp(servers[0]) ? 'border-destructive' : ''}
              />
              {!isValidIp(servers[0]) && (
                <p className="text-xs text-destructive">Invalid IP address format</p>
              )}
            </div>

            {/* Secondary DNS */}
            <div className="grid gap-2">
              <Label htmlFor="secondary-dns">Secondary DNS Server (optional)</Label>
              <Input
                id="secondary-dns"
                placeholder="e.g., 8.8.4.4"
                value={servers[1]}
                onChange={(e) => updateServer(1, e.target.value)}
                className={!isValidIp(servers[1]) ? 'border-destructive' : ''}
              />
              {!isValidIp(servers[1]) && (
                <p className="text-xs text-destructive">Invalid IP address format</p>
              )}
            </div>

            {/* Allow Remote Requests */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-remote">Allow Remote Requests</Label>
                <p className="text-xs text-muted-foreground">
                  Let other devices use this router as a DNS server
                </p>
              </div>
              <Switch
                id="allow-remote"
                checked={allowRemoteRequests}
                onCheckedChange={setAllowRemoteRequests}
              />
            </div>

            {/* Current settings info */}
            {currentSettings && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Current Configuration</p>
                <p className="text-muted-foreground">
                  Servers: {currentSettings.servers && currentSettings.servers.length > 0
                    ? currentSettings.servers.join(', ')
                    : 'Not configured'}
                </p>
                {currentSettings.cacheSize && (
                  <p className="text-muted-foreground">
                    Cache Size: {currentSettings.cacheSize}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !hasValidServers}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
