"use client";

/**
 * Componente de guarda para rotas administrativas
 * Redireciona usuários não-admin para o login
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Spin } from "antd";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Check auth only after hydration and loading
  useEffect(() => {
    if (!hydrated || loading) return;

    // Se não está autenticado ou não é admin, redireciona para login
    if (!user || !isAuthenticated() || !isAdmin()) {
      router.replace("/auth/login");
    }
  }, [hydrated, loading, user, isAuthenticated, isAdmin, router]);

  // Mostra loading enquanto verifica
  if (!hydrated || loading || !user || !isAuthenticated() || !isAdmin()) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}>
        <Spin size="large" tip="Verificando permissões..." />
      </div>
    );
  }

  return <>{children}</>;
}
