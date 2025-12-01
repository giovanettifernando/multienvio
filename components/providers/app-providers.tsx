"use client";

import { useState, type PropsWithChildren } from "react";
import App from "antd/es/app";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";

// Flag para evitar múltiplos redirects simultâneos
let isRedirecting = false;

// Função para tratar erros 401 globalmente
async function handleAuthError(error: unknown) {
  // Verifica se é erro 401 (sessão expirada)
  if (
    error instanceof Error &&
    (error.message.includes("401") ||
      error.message.toLowerCase().includes("unauthorized") ||
      error.message.toLowerCase().includes("não autorizado") ||
      error.message.toLowerCase().includes("sessão expirada"))
  ) {
    // Evita redirect loop se já estiver em página de login ou auth
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const isAuthPage = pathname.includes("/login") || pathname.includes("/auth");

    if (typeof window !== "undefined" && !isAuthPage && !isRedirecting) {
      // Verifica se a sessão realmente expirou fazendo uma chamada ao /api/auth/me
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (response.ok) {
          // Sessão ainda válida, não redireciona (pode ser um erro temporário de outra API)
          return;
        }
      } catch {
        // Erro de rede, não redireciona
        return;
      }

      // Sessão realmente expirou, redireciona
      isRedirecting = true;

      // Limpa dados de autenticação do localStorage
      try {
        localStorage.removeItem("auth-storage");
      } catch {
        // Ignora erro de localStorage
      }

      // Redireciona para login (usando /auth/login que é a rota real)
      window.location.href = "/auth/login";
    }
  }
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            handleAuthError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            handleAuthError(error);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Não retry em erros de autenticação
              if (
                error instanceof Error &&
                (error.message.includes("401") ||
                  error.message.toLowerCase().includes("unauthorized"))
              ) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  // Nota: A verificação de sessão é feita pelo layout do (envio)
  // O handleAuthError trata erros 401 das queries/mutations

  return (
    <QueryClientProvider client={queryClient}>
      <App>{children}</App>
      {/* ReactQueryDevtools disabled due to Next.js 15 compatibility issue */}
      {/* {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null} */}
    </QueryClientProvider>
  );
}
