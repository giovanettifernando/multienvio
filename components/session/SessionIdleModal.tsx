"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Typography, Space } from "antd";
import { ClockCircleOutlined, LogoutOutlined } from "@ant-design/icons";
import { ELModal } from "@/components/ui/ELModal";
import { ELButton } from "@/components/ui/ELButton";

const { Text, Paragraph } = Typography;

// Configurações de tempo
const IDLE_BEFORE_MODAL_MS = 8 * 60 * 1000; // 8 minutos até mostrar modal
const COUNTDOWN_SECONDS = 120; // 2 minutos de countdown (total = 10 min igual ao servidor)

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
}

/**
 * SessionIdleModal - Modal de aviso de inatividade
 *
 * Monitora atividade do usuário e exibe modal antes da sessão expirar.
 * Funciona em conjunto com o timeout do servidor (proxy.ts).
 *
 * - Após 8 min de inatividade: mostra modal com countdown
 * - Countdown de 2 min: permite usuário permanecer ou sair
 * - Se countdown zerar: logout automático e redirect para login
 */
export function SessionIdleModal({
  isAuthenticated,
  onLogout,
  loginPath = "/auth/login",
  returnParam = "returnUrl",
  refreshEndpoint = "/api/auth/refresh",
}: SessionIdleModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Estado do modal e countdown
  const [modalOpen, setModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Refs para timers (evitar memory leaks)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  // Limpar timers (exceto countdown que é controlado por useEffect)
  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Mostrar modal de inatividade
  const showIdleModal = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS); // Reset countdown
    setModalOpen(true);
  }, []);

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
    // Fechar modal (isso para o countdown via useEffect)
    setModalOpen(false);

    // Chamar refresh para renovar sessão (também atualiza last_activity no servidor via proxy)
    try {
      await fetch(refreshEndpoint, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignorar erros - o importante é resetar o timer local
    }

    // Resetar timer de inatividade
    resetIdleTimer();
  }, [refreshEndpoint, resetIdleTimer]);

  // Botão "Sair agora" - logout imediato
  const handleLogoutNow = useCallback(() => {
    clearTimers();
    setModalOpen(false);
    handleLogout();
  }, [clearTimers, handleLogout]);

  // useEffect para controlar o countdown tick - abordagem robusta que funciona com Strict Mode
  useEffect(() => {
    // Só executar se modal está aberto e countdown > 0
    if (!modalOpen || countdown <= 0) return;

    // Agendar próximo tick
    const timer = setTimeout(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          // Countdown zerou - fazer logout
          handleLogout();
          return 0;
        }
        return next;
      });
    }, 1000);

    // Cleanup - sempre limpa o timer quando o effect é re-executado ou desmontado
    return () => clearTimeout(timer);
  }, [modalOpen, countdown, handleLogout]);

  // Setup: adicionar listeners e iniciar timer
  useEffect(() => {
    // Só ativar se usuário está autenticado
    if (!isAuthenticated) return;

    // Evitar double-mount em Strict Mode
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Adicionar listeners de atividade
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer de inatividade
    resetIdleTimer();

    // Cleanup
    return () => {
      mountedRef.current = false;
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [isAuthenticated, handleActivity, resetIdleTimer, clearTimers]);

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
