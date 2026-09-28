import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'fault' | 'air' | 'amber' | 'link';

/** State chip: border and text in the state tone, never a filled badge. */
export function Chip({ children, tone, className }: { children: ReactNode; tone?: ChipTone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium',
        tone === 'fault'
          ? 'border-fault/35 text-fault'
          : tone === 'air'
            ? 'border-air/30 text-air'
            : tone === 'amber'
              ? 'border-amber/35 text-amber'
              : tone === 'link'
                ? 'border-link/35 text-link'
                : 'border-hairline-strong text-ink-3',
        className
      )}
    >
      {children}
    </span>
  );
}
