'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/modules/auth/ui/state/auth';
import { DashboardShell } from '@/shared/ui/layout/dashboard-shell';
import { SessionIdleModal } from '@/modules/auth/ui/components/SessionIdleModal';
import { ELSpin } from '@/shared/ui';
const Spin = ELSpin;

export default function EnvioLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const storeHydrated = useAuthHydrated();
  const [sessionChecked, setSessionChecked] = useState(false);
  const hasValidated = useRef(false);

  // Logout handler para o SessionIdleModal
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Validate session with server after zustand hydration (only once)
  useEffect(() => {
    // Wait for zustand to hydrate from localStorage
    if (!storeHydrated || hasValidated.current) return;

    const validateSession = async () => {
      hasValidated.current = true;

      // Always validate with server - cookies are the source of truth
      // (zustand localStorage may not be updated yet after login due to async persist)
      const serverUser = await fetchCurrentUser();
      if (serverUser) {
        setSessionChecked(true);
      } else {
        // Server says not authenticated - redirect to login
        router.replace('/auth/login');
      }
    };

    validateSession();
  }, [storeHydrated, fetchCurrentUser, router]);

  // Show loading while hydrating zustand or validating session
  // After sessionChecked is true, user is guaranteed to be set by fetchCurrentUser
  if (!storeHydrated || !sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <SessionIdleModal
        isAuthenticated={!!user}
        onLogout={handleLogout}
        loginPath="/auth/login"
        returnParam="returnUrl"
        refreshEndpoint="/api/auth/refresh"
      />
    </>
  );
}
