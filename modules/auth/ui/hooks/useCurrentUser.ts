"use client";

/**
 * Hook para acessar o usuário atual autenticado
 * Faz fetch do /api/auth/me na primeira montagem para sincronizar sessão com backend
 */

import { useEffect, useRef, useState, startTransition } from "react";
import { useAuthStore } from "@/modules/auth/ui/state/useAuthStore";
import type { User } from "@/modules/auth/application/types";

export function useCurrentUser(): { user: User | null; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per app load
    if (hasFetchedRef.current) {
      startTransition(() => {
        setLoading(false);
      });
      return;
    }
    hasFetchedRef.current = true;
    fetchCurrentUser().finally(() => startTransition(() => setLoading(false)));
  }, [fetchCurrentUser]);

  return { user, loading };
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.isAuthenticated());
}

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.isAdmin());
}
