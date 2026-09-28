import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'ink' | 'link' | 'amber' | 'fault' | 'air';

const VALUE_TONE: Record<Tone, string> = {
  ink: 'text-ink',
  link: 'text-link',
  amber: 'text-amber',
  fault: 'text-fault',
  air: 'text-air',
};

/**
 * One figure with its label. The value leads through size + weight; the label
 * is a tracked eyebrow; the hint is metadata. Tiles sit in a single hairline
 * strip (see StatStrip) rather than as separate floating boxes.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'ink',
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 px-4 py-3.5 md:px-5 md:py-4', className)}>
      <div className="eyebrow flex items-center gap-1.5">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('num mt-1.5 text-[22px] font-semibold leading-7 tracking-[-0.01em]', VALUE_TONE[tone])}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/**
 * A row of Stats divided by hairlines — one surface, not N boxes. Three stats
 * stay in one row even on a phone; four fold to 2×2 below md.
 */
export function StatStrip({ children, className, count = 4 }: { children: ReactNode; className?: string; count?: 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-xl border border-hairline bg-panel',
        count === 3
          ? 'grid-cols-3 [&>*]:border-hairline-soft [&>*:not(:last-child)]:border-r'
          : [
              'grid-cols-2 md:grid-cols-4',
              '[&>*]:border-hairline-soft [&>*:nth-child(odd)]:border-r md:[&>*]:border-r md:[&>*:last-child]:border-r-0',
              '[&>*:nth-child(-n+2)]:border-b md:[&>*:nth-child(-n+2)]:border-b-0',
            ],
        className
      )}
    >
      {children}
    </div>
  );
}
