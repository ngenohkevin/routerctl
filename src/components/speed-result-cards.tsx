'use client';

import { ArrowDown, ArrowUp, Clock, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SpeedResultCardsProps {
  ping: number | null;    // ms — available after ping phase
  jitter: number | null;  // ms — available after ping phase
  download: number | null; // Mbps — available after download phase
  upload: number | null;   // Mbps — available after upload phase
  phase: 'idle' | 'ping' | 'download' | 'upload' | 'done';
}

export function SpeedResultCards({ ping, jitter, download, upload, phase }: SpeedResultCardsProps) {
  if (phase === 'idle') return null;

  const cards = [
    {
      title: 'Download',
      value: download !== null ? `${download.toFixed(2)} Mbps` : null,
      icon: ArrowDown,
      color: 'text-green-500',
      active: phase === 'download',
    },
    {
      title: 'Upload',
      value: upload !== null ? `${upload.toFixed(2)} Mbps` : null,
      icon: ArrowUp,
      color: 'text-blue-500',
      active: phase === 'upload',
    },
    {
      title: 'Ping',
      value: ping !== null ? `${ping.toFixed(1)} ms` : null,
      icon: Clock,
      color: 'text-yellow-500',
      active: phase === 'ping',
    },
    {
      title: 'Jitter',
      value: jitter !== null ? `${jitter.toFixed(1)} ms` : null,
      icon: Activity,
      color: 'text-purple-500',
      active: phase === 'ping',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {card.value !== null ? (
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            ) : card.active ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-muted-foreground/30">—</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
