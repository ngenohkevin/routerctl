'use client';

import { Activity, AlertCircle, CheckCircle2, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from '@/types';
import { cn } from '@/lib/utils';

interface AgentStatusProps {
  health: HealthStatus | null;
  isConnected?: boolean;
}

export function AgentStatus({ health, isConnected }: AgentStatusProps) {
  const getStatusConfig = () => {
    if (!health) {
      return {
        icon: AlertCircle,
        label: 'Checking...',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/50',
      };
    }

    switch (health.status) {
      case 'healthy':
        return {
          icon: CheckCircle2,
          label: 'Connected',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/50',
        };
      case 'degraded':
        return {
          icon: AlertCircle,
          label: 'Degraded',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/50',
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Offline',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/50',
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 py-1 px-2.5 font-normal',
        config.bgColor,
        config.borderColor
      )}
    >
      <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
      <span className={config.color}>{config.label}</span>
      {isConnected && (
        <Radio className="h-3 w-3 text-green-500 animate-pulse ml-1" />
      )}
      {health?.routerConnected && (
        <span className="text-muted-foreground ml-1 text-xs">
          Router OK
        </span>
      )}
    </Badge>
  );
}
