'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Spin } from 'antd';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Check auth only after hydration
  useEffect(() => {
    if (!hydrated) return;

    if (!user || !isAuthenticated()) {
      router.replace('/login');
    }
  }, [hydrated, user, isAuthenticated, router]);

  // Show loading while hydrating or redirecting
  if (!hydrated || !user || !isAuthenticated()) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
