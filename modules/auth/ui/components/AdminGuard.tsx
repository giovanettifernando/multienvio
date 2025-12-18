"use client";

/**
 * Componente de guarda para rotas administrativas
 * Redireciona usuários não-admin para o login
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from '@/modules/auth/ui/state/auth';
import { useCurrentUser } from "@/modules/auth/ui/hooks";
import { useHydration } from "@/shared/hooks";
import { Spin } from "antd";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const hydrated = useHydration();

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
        <Spin size="large" tip="Verificando permissões...">
          <div style={{ minHeight: 100 }} />
        </Spin>
      </div>
    );
  }

  return <>{children}</>;
}
