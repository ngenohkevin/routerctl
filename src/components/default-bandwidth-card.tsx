'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { formatBandwidth } from '@/lib/utils';
import { toast } from 'sonner';
import type { DefaultBandwidthConfig } from '@/types';

// The agent stores the limit in bps; the UI edits Mbps.
const toMbps = (bps: string) => {
  const n = parseInt(bps, 10);
  return isNaN(n) || n === 0 ? '' : String(n / 1_000_000);
};

interface DefaultBandwidthCardProps {
  disabled?: boolean;
}

export function DefaultBandwidthCard({ disabled }: DefaultBandwidthCardProps) {
  const [config, setConfig] = useState<DefaultBandwidthConfig | null>(null);
  const [limitMbps, setLimitMbps] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const cfg = await api.getDefaultBandwidth();
      setConfig(cfg);
      setLimitMbps(toMbps(cfg.limit));
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (enabled: boolean) => {
    const mbps = parseFloat(limitMbps);
    if (enabled && (isNaN(mbps) || mbps <= 0)) {
      toast.error('Enter a limit in Mbps first');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateDefaultBandwidth(String(Math.round(mbps * 1_000_000)), enabled);
      toast.success(enabled ? 'Default limit updated' : 'Default limit disabled');
      await fetchConfig();
    } catch {
      toast.error('Failed to update default limit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await api.removeDefaultBandwidth();
      toast.success('Default limit removed');
      await fetchConfig();
    } catch {
      toast.error('Failed to remove default limit');
    } finally {
      setIsSaving(false);
    }
  };

  const active = !!config?.enabled && !!config?.limit && config.limit !== '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Default Bandwidth Limit
        </CardTitle>
        <CardDescription>
          Cap every device that has no dedicated limit. Devices marked
          &quot;Exempt&quot; on the dashboard skip this cap. Currently{' '}
          {active ? `active at ${formatBandwidth(config!.limit)} per device` : 'not active'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="default-limit">Limit per device (Mbps)</Label>
            <Input
              id="default-limit"
              type="number"
              min="0.1"
              step="0.5"
              placeholder="e.g. 3"
              value={limitMbps}
              onChange={(e) => setLimitMbps(e.target.value)}
              className="w-40"
              disabled={disabled || isSaving}
            />
          </div>
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={disabled || isSaving}
          >
            {active ? 'Update' : 'Enable'}
          </Button>
          {active && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={disabled || isSaving}
            >
              Remove Limit
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="default-limit-enabled" className="text-sm text-muted-foreground">
              {active ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="default-limit-enabled"
              checked={active}
              onCheckedChange={(checked) => (checked ? handleSave(true) : handleRemove())}
              disabled={disabled || isSaving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
