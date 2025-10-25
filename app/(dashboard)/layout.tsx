'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [user, isAuthenticated, router]);

  if (!user || !isAuthenticated() || !ready) return null;
  return <DashboardShell>{children}</DashboardShell>;
}
