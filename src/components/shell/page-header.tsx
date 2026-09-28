import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Page title row. The title leads (22/28px, 600, tight tracking); the
 * description is supporting ink; actions sit right and wrap under on phones.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.015em] text-ink md:text-[28px] md:leading-9">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A labelled group within a page. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {aside && <div className="text-xs text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
