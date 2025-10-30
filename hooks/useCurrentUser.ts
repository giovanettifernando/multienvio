"use client";

/**
 * Hook para acessar o usuário atual autenticado
 * Faz fetch do /api/auth/me na primeira montagem para sincronizar sessão com backend
 */

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import type { User } from "@/lib/auth/types";

export function useCurrentUser(): { user: User | null; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // Only fetch once per app load
    if (!hasFetched) {
      setHasFetched(true);
      fetchCurrentUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser, hasFetched]);

  return { user, loading };
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.isAuthenticated());
}

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.isAdmin());
}
