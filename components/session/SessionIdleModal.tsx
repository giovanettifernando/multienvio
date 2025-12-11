"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Typography, Space } from "antd";
import { ClockCircleOutlined, LogoutOutlined } from "@ant-design/icons";
import { ELModal } from "@/components/ui/ELModal";
import { ELButton } from "@/components/ui/ELButton";

const { Text, Paragraph } = Typography;

// ============================================================================
// Configurações de tempo
// ============================================================================
// IMPORTANTE: Cliente 7+2=9 min, Servidor 10 min (1 min de margem de segurança)
const IDLE_BEFORE_MODAL_MS = 7 * 60 * 1000; // 7 minutos até mostrar modal
const COUNTDOWN_SECONDS = 120; // 2 minutos de countdown

// Heartbeat: sincroniza atividade do cliente com o servidor
// Envia ping a cada 2 min para atualizar cookie last_activity no servidor
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos

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
 * Monitora atividade do usuário e exibe modal antes da sessão expirar.
 * Funciona em conjunto com o timeout do servidor (proxy.ts).
 *
 * Correções implementadas:
 * 1. Heartbeat: Sincroniza atividade cliente/servidor a cada 2 min
 * 2. Margem de segurança: Cliente 9 min (7+2), servidor 10 min
 * 3. Side effect fix: handleLogout separado do state updater
 * 4. Refresh preventivo: Renova sessão antes de mostrar modal
 *
 * Fluxo:
 * - Usuário ativo: heartbeat atualiza servidor a cada 2 min
 * - Após 7 min de inatividade: refresh preventivo + mostra modal
 * - Countdown de 2 min: permite usuário permanecer ou sair
 * - Se countdown zerar: logout automático e redirect para login
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
  const lastActivityRef = useRef<number>(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ref para evitar double-mount em Strict Mode
  const mountedRef = useRef(false);

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
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Enviar heartbeat para servidor (atualiza last_activity cookie)
  const sendHeartbeat = useCallback(async () => {
    try {
      const response = await fetch(heartbeatEndpoint, {
        method: "POST",
        credentials: "include",
      });

      // Se heartbeat falhou com 401, sessão já expirou
      if (response.status === 401) {
        console.warn("[SessionIdleModal] Heartbeat retornou 401 - sessão expirada");
        handleLogout();
        return;
      }

      // Se heartbeat retornou que precisa de refresh, fazer proativamente
      if (response.ok) {
        try {
          const data = await response.json();
          if (data.needsTokenRefresh) {
            // Access token expirou, fazer refresh proativo
            await fetch(refreshEndpoint, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch {
          // Ignorar erros de parse - não é crítico
        }
      }
    } catch {
      // Silencioso - erro de rede não deve interromper
    }
  }, [heartbeatEndpoint, refreshEndpoint, handleLogout]);

  // Mostrar modal de inatividade (com refresh preventivo)
  const showIdleModal = useCallback(async () => {
    // Refresh preventivo antes de mostrar modal
    // Garante que a sessão está renovada no servidor
    try {
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      // Se refresh falhou, sessão já expirou - logout direto
      if (!response.ok) {
        console.warn("[SessionIdleModal] Refresh preventivo falhou - logout");
        handleLogout();
        return;
      }
    } catch {
      // Em caso de erro de rede, ainda mostrar modal
      // Deixar usuário decidir
    }

    // Mostrar modal com countdown
    setCountdown(COUNTDOWN_SECONDS);
    setModalOpen(true);
  }, [refreshEndpoint, handleLogout]);

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

    // Heartbeat periódico enquanto usuário está ativo
    heartbeatIntervalRef.current = setInterval(() => {
      // Só enviar heartbeat se houve atividade recente (não no modal)
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity < HEARTBEAT_INTERVAL_MS * 1.5) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat]);

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
    try {
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      // Se refresh falhou (401), a sessão já expirou no servidor
      if (!response.ok) {
        handleLogout();
        return;
      }
    } catch {
      // Em caso de erro de rede, tentar manter a sessão local
    }

    // Resetar timer de inatividade e heartbeat
    resetIdleTimer();
    startHeartbeat();
  }, [refreshEndpoint, resetIdleTimer, startHeartbeat, handleLogout]);

  // Botão "Sair agora" - logout imediato
  const handleLogoutNow = useCallback(() => {
    clearAllTimers();
    setModalOpen(false);
    handleLogout();
  }, [clearAllTimers, handleLogout]);

  // ============================================================================
  // useEffect para countdown tick
  // CORREÇÃO: handleLogout removido do state updater (side effect)
  // ============================================================================
  useEffect(() => {
    // Só executar se modal está aberto e countdown > 0
    if (!modalOpen || countdown <= 0) return;

    // Agendar próximo tick
    const timer = setTimeout(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [modalOpen, countdown]);

  // useEffect separado para detectar countdown zerado
  // CORREÇÃO: Separar side effect (logout) do state updater
  useEffect(() => {
    if (modalOpen && countdown === 0 && !isLoggingOut) {
      handleLogout();
    }
  }, [modalOpen, countdown, isLoggingOut, handleLogout]);

  // ============================================================================
  // Setup: adicionar listeners, timers e heartbeat
  // ============================================================================
  useEffect(() => {
    // Só ativar se usuário está autenticado
    if (!isAuthenticated) return;

    // Evitar double-mount em Strict Mode
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Inicializar timestamp de última atividade
    lastActivityRef.current = Date.now();

    // Adicionar listeners de atividade
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer de inatividade
    resetIdleTimer();

    // Iniciar heartbeat (sincroniza cliente/servidor)
    startHeartbeat();

    // Enviar heartbeat inicial
    sendHeartbeat();

    // Cleanup
    return () => {
      mountedRef.current = false;
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [isAuthenticated, handleActivity, resetIdleTimer, startHeartbeat, sendHeartbeat, clearAllTimers]);

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
