'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { HomePowerView } from '@/components/home-power/home-power-view';
import { UpsView } from '@/components/ups-view';
import { isAuthenticated } from '@/lib/api';
import { powerMode, usePower } from '@/stores/power';

export default function PowerPage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  const power = usePower();
  const mode = powerMode(power);

  return (
    <AppShell>
      {mode === 'plugs' ? (
        <HomePowerView />
      ) : mode === 'ups' ? (
        <UpsView />
      ) : (
        <div className="space-y-6">
          <PageHeader title="Power" description="Checking how the Pi watches the power…" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </AppShell>
  );
}
