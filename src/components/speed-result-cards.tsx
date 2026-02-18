'use client';

import { ArrowDown, ArrowUp, Clock, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NetSpeedTestResult } from '@/types';

interface SpeedResultCardsProps {
  result: NetSpeedTestResult | null;
}

export function SpeedResultCards({ result }: SpeedResultCardsProps) {
  if (!result) return null;

  const cards = [
    {
      title: 'Download',
      value: `${result.download.toFixed(2)} Mbps`,
      icon: ArrowDown,
      color: 'text-green-500',
    },
    {
      title: 'Upload',
      value: `${result.upload.toFixed(2)} Mbps`,
      icon: ArrowUp,
      color: 'text-blue-500',
    },
    {
      title: 'Ping',
      value: `${result.ping.toFixed(1)} ms`,
      icon: Clock,
      color: 'text-yellow-500',
    },
    {
      title: 'Jitter',
      value: `${result.jitter.toFixed(1)} ms`,
      icon: Activity,
      color: 'text-purple-500',
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
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
