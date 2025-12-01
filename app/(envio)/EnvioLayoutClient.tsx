'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Spin } from 'antd';
import { useHydration } from '@/hooks/useHydration';

export default function EnvioLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const hydrated = useHydration();
  const [sessionChecked, setSessionChecked] = useState(false);
  const hasValidated = useRef(false);

  // Validate session with server after hydration (only once)
  useEffect(() => {
    if (!hydrated || hasValidated.current) return;

    const validateSession = async () => {
      hasValidated.current = true;

      // If we have user in localStorage, validate with server
      if (user) {
        const serverUser = await fetchCurrentUser();
        if (!serverUser) {
          // Session expired on server, redirect to login
          router.replace('/auth/login');
          return;
        }
      } else if (!isAuthenticated()) {
        // No user in store, redirect to login
        router.replace('/auth/login');
        return;
      }
      setSessionChecked(true);
    };

    validateSession();
  }, [hydrated, user, isAuthenticated, fetchCurrentUser, router]);

  // Show loading while hydrating or validating session
  if (!hydrated || !sessionChecked || !user || !isAuthenticated()) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
