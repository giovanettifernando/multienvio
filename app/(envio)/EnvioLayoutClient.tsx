'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/stores/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Spin } from 'antd';

export default function EnvioLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const storeHydrated = useAuthHydrated();
  const [sessionChecked, setSessionChecked] = useState(false);
  const hasValidated = useRef(false);

  // Validate session with server after zustand hydration (only once)
  useEffect(() => {
    // Wait for zustand to hydrate from localStorage
    if (!storeHydrated || hasValidated.current) return;

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
        // No user in store after hydration, redirect to login
        router.replace('/auth/login');
        return;
      }
      setSessionChecked(true);
    };

    validateSession();
  }, [storeHydrated, user, isAuthenticated, fetchCurrentUser, router]);

  // Show loading while hydrating zustand or validating session
  if (!storeHydrated || !sessionChecked || !user || !isAuthenticated()) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
