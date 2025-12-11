"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Typography, Space } from "antd";
import { ClockCircleOutlined, LogoutOutlined } from "@ant-design/icons";
import { ELModal } from "@/components/ui/ELModal";
import { ELButton } from "@/components/ui/ELButton";

const { Text, Paragraph } = Typography;

// ============================================================================
// Configurações de tempo - SINCRONIZADAS COM SERVIDOR
// ============================================================================
// Servidor (proxy.ts): SESSION_IDLE_MINUTES = 10 min
// Cliente: mostra modal em 7 min + countdown de 2 min = 9 min total
// Margem de segurança: 1 minuto
const IDLE_BEFORE_MODAL_MS = 7 * 60 * 1000; // 7 minutos até mostrar modal
const COUNTDOWN_SECONDS = 120; // 2 minutos de countdown

// Heartbeat: sincroniza atividade do cliente com o servidor
// IMPORTANTE: Intervalo curto para garantir que last_activity seja atualizado frequentemente
const HEARTBEAT_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto (mais frequente para evitar gaps)

// Token Refresh: garantir que access token nunca expire enquanto usuário está ativo
// Access token = 15 min, refresh a cada 5 min = sempre válido com margem
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// Eventos que indicam atividade do usuário
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart", "click"] as const;

// Debounce para evitar excesso de atualizações
const ACTIVITY_DEBOUNCE_MS = 1000;

interface SessionIdleModalProps {
  /** Se o usuário está autenticado */
  isAuthenticated: boolean;
  /** Função de logout */
  onLogout: () => Promise<void>;
  /** Rota de login para redirect (default: /auth/login) */
  loginPath?: string;
  /** Parâmetro de retorno na URL (default: returnUrl) */
  returnParam?: string;
  /** Endpoint de refresh/keepalive (default: /api/auth/refresh) */
  refreshEndpoint?: string;
  /** Endpoint de heartbeat (default: /api/auth/heartbeat) */
  heartbeatEndpoint?: string;
}

/**
 * SessionIdleModal - Modal de aviso de inatividade
 *
 * ARQUITETURA DE SESSÃO:
 *
 * 1. Access Token (15 min): Usado pelo proxy para autenticar requisições
 * 2. Refresh Token (7 dias): Usado para renovar access token
 * 3. last_activity cookie: Rastreia última atividade no servidor (timeout 10 min)
 *
 * PROBLEMA ANTERIOR:
 * - Heartbeat parava após 3 min de inatividade
 * - Access token expirava (15 min) e requisições falhavam com 401
 * - Usuário era redirecionado sem ver o modal
 *
 * SOLUÇÃO:
 * 1. Heartbeat frequente (1 min) enquanto houver atividade recente (últimos 8 min)
 * 2. Refresh proativo do token a cada 5 min (access token = 15 min)
 * 3. Refresh automático quando heartbeat indica necessidade
 * 4. Modal aparece em 7 min + countdown 2 min = 9 min (antes do timeout de 10 min)
 */
export function SessionIdleModal({
  isAuthenticated,
  onLogout,
  loginPath = "/auth/login",
  returnParam = "returnUrl",
  refreshEndpoint = "/api/auth/refresh",
  heartbeatEndpoint = "/api/auth/heartbeat",
}: SessionIdleModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Estado do modal e countdown
  const [modalOpen, setModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Refs para timers (evitar memory leaks)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Formatar countdown para MM:SS
  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Executar logout e redirect
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await onLogout();
    } catch {
      // Ignorar erros - logout local já foi feito
    }

    // Redirect para login com returnUrl
    const loginUrl = new URL(loginPath, window.location.origin);
    loginUrl.searchParams.set(returnParam, pathname);
    loginUrl.searchParams.set("reason", "inactivity");
    router.replace(loginUrl.toString());
  }, [onLogout, loginPath, returnParam, pathname, router, isLoggingOut]);

  // Limpar todos os timers
  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Refresh do token (renovar access token)
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        lastRefreshRef.current = Date.now();
        console.debug("[Session] Token refreshed successfully");
        return true;
      }

      // Se refresh falhou com 401, sessão expirou
      if (response.status === 401) {
        console.warn("[Session] Refresh failed with 401 - session expired");
        return false;
      }

      console.warn("[Session] Refresh failed with status:", response.status);
      return false;
    } catch (error) {
      console.error("[Session] Refresh error:", error);
      return false;
    }
  }, [refreshEndpoint]);

  // Enviar heartbeat para servidor (atualiza last_activity cookie)
  const sendHeartbeat = useCallback(async () => {
    try {
      const response = await fetch(heartbeatEndpoint, {
        method: "POST",
        credentials: "include",
      });

      // Se heartbeat falhou com 401, sessão já expirou no servidor
      // MAS só fazer logout se já passou do período inicial (evita loop no login)
      if (response.status === 401) {
        console.warn("[Session] Heartbeat 401 - session expired on server");
        // Só faz logout se já está inicializado há mais de 5 segundos
        if (isInitializedRef.current) {
          handleLogout();
        } else {
          console.debug("[Session] Ignoring 401 during initialization");
        }
        return;
      }

      if (response.ok) {
        try {
          const data = await response.json();

          // Se access token precisa de refresh, fazer imediatamente
          if (data.needsTokenRefresh) {
            console.debug("[Session] Heartbeat indicates token needs refresh");
            const refreshed = await refreshToken();
            if (!refreshed) {
              // Se refresh falhou, sessão inválida
              handleLogout();
              return;
            }
          }
        } catch {
          // Ignorar erros de parse
        }
      }
    } catch (error) {
      // Erro de rede - silencioso, não interrompe
      console.debug("[Session] Heartbeat network error:", error);
    }
  }, [heartbeatEndpoint, handleLogout, refreshToken]);

  // Mostrar modal de inatividade (com refresh preventivo)
  const showIdleModal = useCallback(async () => {
    // Refresh preventivo antes de mostrar modal
    // Garante que a sessão está renovada no servidor
    const refreshed = await refreshToken();

    if (!refreshed) {
      // Se refresh falhou, sessão já expirou - logout direto
      console.warn("[Session] Preventive refresh failed - logging out");
      handleLogout();
      return;
    }

    // Mostrar modal com countdown
    setCountdown(COUNTDOWN_SECONDS);
    setModalOpen(true);
  }, [refreshToken, handleLogout]);

  // Resetar timer de inatividade
  const resetIdleTimer = useCallback(() => {
    // Limpar timer existente
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Iniciar novo timer
    idleTimerRef.current = setTimeout(() => {
      showIdleModal();
    }, IDLE_BEFORE_MODAL_MS);

    lastActivityRef.current = Date.now();
  }, [showIdleModal]);

  // Iniciar heartbeat
  const startHeartbeat = useCallback(() => {
    // Limpar interval existente
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Heartbeat periódico - CRÍTICO para manter last_activity atualizado
    // Envia enquanto houve atividade nos últimos 8 minutos (antes do modal em 7 min + margem)
    heartbeatIntervalRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      // Continuar enviando heartbeat até 8 minutos de inatividade
      // Isso garante que o servidor receba atualizações até perto do modal
      if (timeSinceActivity < IDLE_BEFORE_MODAL_MS + HEARTBEAT_INTERVAL_MS) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat]);

  // Iniciar refresh periódico do token
  const startTokenRefresh = useCallback(() => {
    // Limpar interval existente
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
    }

    // Refresh periódico do token - garante que access token nunca expire
    // Só faz refresh se houve atividade recente (evita refresh quando já está inativo)
    tokenRefreshIntervalRef.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;

      // Só refresh se:
      // 1. Houve atividade nos últimos 8 minutos
      // 2. Não fez refresh nos últimos 4 minutos (evitar excesso)
      if (
        timeSinceActivity < IDLE_BEFORE_MODAL_MS + HEARTBEAT_INTERVAL_MS &&
        timeSinceLastRefresh >= TOKEN_REFRESH_INTERVAL_MS - 60000
      ) {
        await refreshToken();
      }
    }, TOKEN_REFRESH_INTERVAL_MS);
  }, [refreshToken]);

  // Handler de atividade do usuário (debounced)
  const handleActivity = useCallback(() => {
    // Não resetar se modal está aberto (usuário deve clicar no botão)
    if (modalOpen) return;

    // Debounce para evitar excesso de chamadas
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      resetIdleTimer();
    }, ACTIVITY_DEBOUNCE_MS);
  }, [modalOpen, resetIdleTimer]);

  // Botão "Permanecer aqui" - renovar sessão
  const handleStayHere = useCallback(async () => {
    // Fechar modal primeiro (para parar o countdown)
    setModalOpen(false);

    // Chamar refresh para renovar sessão
    const refreshed = await refreshToken();

    if (!refreshed) {
      // Se refresh falhou, sessão já expirou no servidor
      handleLogout();
      return;
    }

    // Resetar timer de inatividade e reiniciar intervals
    resetIdleTimer();
    startHeartbeat();
    startTokenRefresh();
  }, [refreshToken, resetIdleTimer, startHeartbeat, startTokenRefresh, handleLogout]);

  // Botão "Sair agora" - logout imediato
  const handleLogoutNow = useCallback(() => {
    clearAllTimers();
    setModalOpen(false);
    handleLogout();
  }, [clearAllTimers, handleLogout]);

  // ============================================================================
  // useEffect para countdown tick
  // ============================================================================
  useEffect(() => {
    if (!modalOpen || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [modalOpen, countdown]);

  // useEffect separado para detectar countdown zerado
  useEffect(() => {
    if (modalOpen && countdown === 0 && !isLoggingOut) {
      // Usar setTimeout para evitar chamada síncrona dentro do efeito
      const timeoutId = setTimeout(() => {
        handleLogout();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [modalOpen, countdown, isLoggingOut, handleLogout]);

  // ============================================================================
  // Setup principal: adicionar listeners, timers e heartbeat
  // ============================================================================
  useEffect(() => {
    // Só ativar se usuário está autenticado
    if (!isAuthenticated) return;

    // Inicializar timestamps
    const now = Date.now();
    lastActivityRef.current = now;
    lastRefreshRef.current = now;

    // Adicionar listeners de atividade
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer de inatividade
    resetIdleTimer();

    // Iniciar heartbeat (sincroniza cliente/servidor)
    startHeartbeat();

    // Iniciar refresh periódico do token
    startTokenRefresh();

    // Fazer refresh inicial após um delay mais longo (garante token válido)
    // NÃO chamar sendHeartbeat no início - pode causar logout prematuro
    // O heartbeat interval cuidará disso após 1 minuto
    // NOTA: Delay de 2s para garantir que cookies foram processados após login
    const initTimeoutId = setTimeout(() => {
      // Apenas refresh silencioso - não faz logout se falhar
      refreshToken().catch(() => {
        // Silently ignore - proxy will handle auth on next request
      });
    }, 2000);

    // Marcar como inicializado após 5 segundos (evita logout durante startup)
    const initFlagTimeoutId = setTimeout(() => {
      isInitializedRef.current = true;
    }, 5000);

    // Cleanup
    return () => {
      clearTimeout(initTimeoutId);
      clearTimeout(initFlagTimeoutId);
      isInitializedRef.current = false;
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nota: Dependências intencionalmente reduzidas para evitar re-runs desnecessários
  // Os callbacks são estáveis via useCallback

  // Não renderizar se usuário não está autenticado
  if (!isAuthenticated) return null;

  return (
    <ELModal
      title={
        <Space>
          <ClockCircleOutlined style={{ color: "var(--color-warning)" }} />
          <span>Você ainda está aí?</span>
        </Space>
      }
      open={modalOpen}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <ELButton
            variant="default"
            icon={<LogoutOutlined />}
            onClick={handleLogoutNow}
            disabled={isLoggingOut}
          >
            Sair agora
          </ELButton>
          <ELButton
            variant="primary"
            onClick={handleStayHere}
            disabled={isLoggingOut}
          >
            Permanecer aqui
          </ELButton>
        </Space>
      }
      size="sm"
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Paragraph style={{ margin: 0 }}>
          Por segurança, sua sessão será encerrada automaticamente em{" "}
          <Text strong style={{ color: "var(--color-error)", fontSize: 18 }}>
            {formatCountdown(countdown)}
          </Text>{" "}
          devido à inatividade.
        </Paragraph>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Se você estiver em um computador compartilhado, encerraremos sua sessão para
          proteger seus dados.
        </Text>
      </Space>
    </ELModal>
  );
}
