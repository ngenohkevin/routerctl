'use client';

import { useState, useEffect } from 'react';
import { Network, Loader2 } from 'lucide-react';
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
import type { DHCPNetwork } from '@/types';

interface DhcpDnsDialogProps {
  network: DHCPNetwork | null;
  onSave: (networkId: string, dnsServers: string[]) => Promise<void>;
  disabled?: boolean;
}

const DNS_PRESETS = [
  { name: 'Pi-hole', servers: ['10.10.10.101'] },
  { name: 'Pi-hole + Cloudflare', servers: ['10.10.10.101', '1.1.1.1'] },
  { name: 'Cloudflare', servers: ['1.1.1.1', '1.0.0.1'] },
  { name: 'Google', servers: ['8.8.8.8', '8.8.4.4'] },
];

export function DhcpDnsDialog({
  network,
  onSave,
  disabled,
}: DhcpDnsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [servers, setServers] = useState<string[]>(['', '']);

  // Initialize form when dialog opens or network changes
  useEffect(() => {
    if (network && open) {
      const currentServers = network.dnsServers ?? [];
      setServers([
        currentServers[0] ?? '',
        currentServers[1] ?? '',
      ]);
    }
  }, [network, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!network) return;

    // Filter out empty servers
    const validServers = servers.filter((s) => s.trim() !== '');
    if (validServers.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(network.id, validServers);
      setOpen(false);
    } catch (error) {
      // Error handling done in parent
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (preset: typeof DNS_PRESETS[0]) => {
    setServers([preset.servers[0] ?? '', preset.servers[1] ?? '']);
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
        <Button variant="outline" size="sm" disabled={disabled || !network}>
          <Network className="h-4 w-4 mr-2" />
          Configure DHCP DNS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              DHCP DNS Settings
            </DialogTitle>
            <DialogDescription>
              Configure DNS servers that DHCP assigns to clients. This determines
              what DNS servers devices receive when they connect.
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
              <Label htmlFor="dhcp-primary-dns">Primary DNS Server</Label>
              <Input
                id="dhcp-primary-dns"
                placeholder="e.g., 10.10.10.101"
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
              <Label htmlFor="dhcp-secondary-dns">Secondary DNS Server (optional)</Label>
              <Input
                id="dhcp-secondary-dns"
                placeholder="e.g., 1.1.1.1"
                value={servers[1]}
                onChange={(e) => updateServer(1, e.target.value)}
                className={!isValidIp(servers[1]) ? 'border-destructive' : ''}
              />
              {!isValidIp(servers[1]) && (
                <p className="text-xs text-destructive">Invalid IP address format</p>
              )}
            </div>

            {/* Network info */}
            {network && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Network: {network.address}</p>
                <p className="text-muted-foreground">
                  Current DNS: {network.dnsServers && network.dnsServers.length > 0
                    ? network.dnsServers.join(', ')
                    : 'Not configured'}
                </p>
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
