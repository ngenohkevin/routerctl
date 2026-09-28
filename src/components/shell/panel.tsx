import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one card chrome in the app: panel surface, hairline edge, 12px radius,
 * 16px (phone) / 20px (desktop) padding. Hierarchy comes from what's inside,
 * not from heavier boxes.
 */
export function Panel({
  children,
  className,
  tone,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Edge tint when the panel itself carries a state. */
  tone?: 'amber' | 'fault';
  as?: 'div' | 'section';
}) {
  return (
    <Tag
      className={cn(
        'rounded-xl border bg-panel p-4 md:p-5',
        tone === 'fault' ? 'border-fault/40' : tone === 'amber' ? 'border-amber/35' : 'border-hairline',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  icon,
  aside,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3.5 flex items-center justify-between gap-3', className)}>
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
        {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
        <span className="truncate">{title}</span>
      </h2>
      {aside && <div className="flex shrink-0 items-center gap-2 text-xs text-ink-3">{aside}</div>}
    </div>
  );
}
