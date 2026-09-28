'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  MonitorSmartphone,
  Gauge,
  Activity,
  Network,
  ScrollText,
  Settings,
  Power,
  LogOut,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RebootDialog } from '@/components/reboot-dialog';
import { Led } from '@/components/shell/led';
import type { HealthStatus } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutGrid },
  { href: '/devices', label: 'Devices', icon: MonitorSmartphone },
  { href: '/speed-test', label: 'Speed test', icon: Gauge },
  { href: '/traffic', label: 'Traffic', icon: Activity },
  { href: '/dhcp', label: 'DHCP', icon: Network },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// The phone's tab bar holds the four daily destinations; the rest live under More.
const TAB_BAR = NAV.slice(0, 4);
const MORE = NAV.slice(4);

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** The router mark: a unit with its three front LEDs. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect x="1.5" y="8.5" width="25" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="14" r="1.6" fill="var(--link)" />
      <circle cx="12.5" cy="14" r="1.6" fill="var(--air)" />
      <circle cx="17.5" cy="14" r="1.6" fill="var(--amber)" opacity="0.55" />
      <path d="M9 8.5 6 3.5M19 8.5l3-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Polls agent + router health for the connection light. */
function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .getHealth()
        .then((h) => alive && setHealth(h))
        .catch(
          () =>
            alive &&
            setHealth({ status: 'offline', routerConnected: false, timestamp: new Date().toISOString() })
        );
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return health;
}

function ConnectionLight({ health, compact = false }: { health: HealthStatus | null; compact?: boolean }) {
  const ok = health?.status === 'healthy' && health.routerConnected;
  const degraded = health?.status === 'degraded' || (health?.status === 'healthy' && !health.routerConnected);
  const tone = !health ? 'off' : ok ? 'link' : degraded ? 'amber' : 'fault';
  const text = !health
    ? 'Checking…'
    : ok
      ? 'Router connected'
      : degraded
        ? 'Router unreachable'
        : 'Agent offline';
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs text-ink-3" title={text}>
      <Led tone={tone} live={ok} label={text} />
      {!compact && <span className="truncate">{text}</span>}
    </span>
  );
}

async function reboot() {
  try {
    await api.rebootRouter();
    toast.success('Router is rebooting — back in about a minute');
  } catch (error) {
    toast.error('Failed to reboot router');
    throw error;
  }
}

/**
 * The app frame. Desktop: a 232px rail (navigation serves content) with the
 * connection light and the two dangerous actions pinned to its foot. Phone:
 * a slim top bar and a bottom tab bar within thumb reach, the PWA's home.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const health = useHealth();
  const [moreOpen, setMoreOpen] = useState(false);
  const routerDown = !health?.routerConnected;
  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-hairline bg-canvas lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2.5 px-5 text-ink">
          <Mark className="size-7 text-ink-2" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">RouterCtl</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150',
                  active ? 'bg-raised font-medium text-ink' : 'text-ink-3 hover:bg-panel hover:text-ink-2'
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-link" aria-hidden />}
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-hairline px-3 py-3">
          <div className="px-3 py-2">
            <ConnectionLight health={health} />
          </div>
          <RebootDialog
            onReboot={reboot}
            disabled={routerDown}
            trigger={
              <button
                type="button"
                disabled={routerDown}
                className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-3 transition-colors hover:bg-panel hover:text-fault disabled:pointer-events-none disabled:opacity-40"
              >
                <Power className="size-4" />
                Reboot router
              </button>
            }
          />
          <button
            type="button"
            onClick={() => api.logout()}
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-3 transition-colors hover:bg-panel hover:text-ink-2"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-canvas/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75 lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Mark className="size-6 text-ink-2" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            {current && current.href !== '/' ? current.label : 'RouterCtl'}
          </span>
        </Link>
        <ConnectionLight health={health} />
      </header>

      <main className="pb-28 lg:pb-12 lg:pl-[232px]">
        <div className="mx-auto w-full max-w-[1360px] px-4 pt-5 md:px-6 md:pt-7 lg:px-10 lg:pt-9">{children}</div>
      </main>

      {/* Phone / tablet tab bar */}
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-canvas/90 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/80 lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {TAB_BAR.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-4 hover:text-ink-3'
                )}
              >
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-raised')}>
                  <item.icon className="size-[18px]" />
                </span>
                {item.label === 'Speed test' ? 'Speed' : item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              MORE.some((m) => isActive(pathname, m.href)) ? 'text-ink' : 'text-ink-4 hover:text-ink-3'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full',
                MORE.some((m) => isActive(pathname, m.href)) && 'bg-raised'
              )}
            >
              <MoreHorizontal className="size-[18px]" />
            </span>
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-hairline bg-panel px-3 pb-8">
          <SheetHeader className="px-3">
            <SheetTitle className="text-left text-sm font-medium text-ink-3">More</SheetTitle>
          </SheetHeader>
          <div className="space-y-0.5">
            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] text-ink-2 transition-colors hover:bg-raised"
              >
                <item.icon className="size-5 text-ink-3" />
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-hairline" />
            <RebootDialog
              onReboot={reboot}
              disabled={routerDown}
              trigger={
                <button
                  type="button"
                  disabled={routerDown}
                  className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] text-fault transition-colors hover:bg-raised disabled:opacity-40"
                >
                  <Power className="size-5" />
                  Reboot router
                </button>
              }
            />
            <button
              type="button"
              onClick={() => api.logout()}
              className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] text-ink-2 transition-colors hover:bg-raised"
            >
              <LogOut className="size-5 text-ink-3" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
