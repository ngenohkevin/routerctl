import { cn } from '@/lib/utils';

export type LedTone = 'link' | 'amber' | 'fault' | 'air' | 'off';

const TONE: Record<LedTone, string> = {
  link: 'bg-link shadow-[0_0_0_3px_color-mix(in_oklch,var(--link)_18%,transparent)]',
  amber: 'bg-amber shadow-[0_0_0_3px_color-mix(in_oklch,var(--amber)_18%,transparent)]',
  fault: 'bg-fault shadow-[0_0_0_3px_color-mix(in_oklch,var(--fault)_20%,transparent)]',
  air: 'bg-air shadow-[0_0_0_3px_color-mix(in_oklch,var(--air)_18%,transparent)]',
  off: 'bg-ink-4',
};

/**
 * A status light, the way a router's face shows state: link, activity, fault.
 * `live` pulses slowly for something carrying traffic right now.
 */
export function Led({
  tone,
  live = false,
  className,
  label,
}: {
  tone: LedTone;
  live?: boolean;
  className?: string;
  /** Accessible name; the colour alone never carries meaning. */
  label?: string;
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block size-2 shrink-0 rounded-full', TONE[tone], live && 'animate-led', className)}
    />
  );
}

/** Map a line/radio state onto an LED tone. */
export function toneFor(state?: string): LedTone {
  switch (state) {
    case 'up':
    case 'healthy':
    case 'running':
      return 'link';
    case 'degraded':
      return 'amber';
    case 'severe':
    case 'down':
    case 'offline':
      return 'fault';
    default:
      return 'off';
  }
}
