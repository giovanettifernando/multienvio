"use client";

import { useState, useRef, useEffect, useCallback, Suspense, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import Avatar from "antd/es/avatar";
import Badge from "antd/es/badge";
import Button from "antd/es/button";
import Input from "antd/es/input";
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined, ToolOutlined } from "@ant-design/icons";
import { cn } from "@/lib/utils/cn";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import styles from "./AssistantChat.module.css";

/**
 * Rotas onde o assistente NÃO deve aparecer
 */
const HIDDEN_ROUTES = [
  "/admin",
  "/coletores",
  "/collectors",
  "/auth",
  "/coletor", // área pública do coletor
];

const { TextArea } = Input;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface ChatResponse {
  response: string;
  sessionId: string;
  messageId: string;
  toolsUsed: string[];
  debugSummary?: DebugSummary;
  debugEvents?: DebugEvent[];
}

interface DebugSummary {
  requestId: string;
  durationMs: number;
  callsTotal: number;
  toolCallsTotal: number;
  retriesTotal: number;
  fallbackUsed: boolean;
  success: boolean;
  error?: string;
}

interface DebugEvent {
  type: string;
  requestId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Olá! Sou o assistente virtual do Envio Legal. Como posso ajudar você hoje?",
    timestamp: new Date(),
  },
];

// Request timeout in milliseconds (60 seconds)
const REQUEST_TIMEOUT_MS = 60_000;

// localStorage keys for chat persistence
const STORAGE_KEY_MESSAGES = 'assistant_chat_messages';
const STORAGE_KEY_SESSION = 'assistant_chat_session';
const STORAGE_KEY_USER = 'assistant_chat_user';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedChatData {
  messages: Message[];
  sessionId: string | null;
  timestamp: number;
}

/**
 * Saves chat data to localStorage
 */
function saveChatToStorage(userId: string, messages: Message[], sessionId: string | null): void {
  try {
    // Only save if there are messages beyond the welcome message
    if (messages.length <= 1) return;

    const data: CachedChatData = {
      messages,
      sessionId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEY_USER, userId);
  } catch {
    // Ignore storage errors (quota exceeded, etc)
  }
}

/**
 * Loads chat data from localStorage
 * Returns null if data is expired or belongs to different user
 */
function loadChatFromStorage(userId: string): CachedChatData | null {
  try {
    const storedUserId = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUserId !== userId) {
      // Clear cache if different user
      clearChatStorage();
      return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!stored) return null;

    const data: CachedChatData = JSON.parse(stored);

    // Check if cache is expired (24 hours)
    if (Date.now() - data.timestamp > CACHE_MAX_AGE_MS) {
      clearChatStorage();
      return null;
    }

    // Restore Date objects from JSON
    data.messages = data.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));

    return data;
  } catch {
    clearChatStorage();
    return null;
  }
}

/**
 * Clears chat data from localStorage
 */
function clearChatStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook interno para obter debug flag via URL param
 * Isolado para permitir Suspense boundary
 */
function useDebugFlag(): boolean {
  const searchParams = useSearchParams();
  return searchParams?.get("assistantDebug") === "1";
}

/**
 * Componente interno que usa useSearchParams
 * Deve ser usado dentro de Suspense
 */
function AssistantChatInner() {
  const pathname = usePathname();
  const debugEnabled = useDebugFlag();
  const { user } = useCurrentUser();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Verifica se deve esconder o assistente
  const shouldHide = !user || HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));

  // Garante que só renderiza no client (para createPortal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load chat from localStorage on mount
  useEffect(() => {
    if (!user?.id) return;

    const cached = loadChatFromStorage(user.id);
    if (cached) {
      setMessages(cached.messages);
      setSessionId(cached.sessionId);
      if (debugEnabled) {
        console.log('[ASSISTANT_DEBUG] Loaded chat from localStorage', {
          messagesCount: cached.messages.length,
          sessionId: cached.sessionId,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60) + ' minutes',
        });
      }
    }
  }, [user?.id, debugEnabled]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (!user?.id || !mounted) return;

    // Debounce saving to avoid excessive writes
    const timeoutId = setTimeout(() => {
      saveChatToStorage(user.id, messages, sessionId);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [messages, sessionId, user?.id, mounted]);

  // Scroll para última mensagem
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Foca no input quando abre
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, scrollToBottom]);

  // Fecha com ESC
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Fecha ao clicar fora (apenas mobile)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isOpen) return;

      const isMobile = window.innerWidth < 768;
      if (!isMobile) return;

      const target = e.target as Node;
      const panel = panelRef.current;
      const launcher = document.getElementById("assistant-chat-launcher");

      if (panel && !panel.contains(target) && launcher && !launcher.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content) return;

    // Anti-double-submit: prevent sending while already sending
    if (isSending) {
      if (debugEnabled) {
        console.warn("[ASSISTANT_DEBUG] Blocked double submit attempt");
      }
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Generate unique request ID for idempotency and tracing
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setIsSending(true);
    setError(null);

    // Debug logging
    if (debugEnabled) {
      console.groupCollapsed(`[ASSISTANT_DEBUG][requestId=${requestId}] Request Start`);
      console.log("Message:", content.slice(0, 100) + (content.length > 100 ? "..." : ""));
      console.log("SessionId:", sessionId || "(new session)");
      console.log("Timestamp:", new Date().toISOString());
      console.groupEnd();
    }

    // Setup request timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
      if (debugEnabled) {
        console.warn(`[ASSISTANT_DEBUG][requestId=${requestId}] Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-assistant-request-id": requestId,
          ...(debugEnabled && { "x-assistant-debug": "1" }),
        },
        body: JSON.stringify({
          message: content,
          sessionId: sessionId || undefined,
          includeHistory: true,
        }),
        signal: abortController.signal,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || json.error || "Erro ao processar mensagem");
      }

      const data: ChatResponse = json.data ?? json;

      // Debug logging for response
      if (debugEnabled) {
        const duration = Date.now() - startTime;
        console.groupCollapsed(`[ASSISTANT_DEBUG][requestId=${requestId}] Response (${duration}ms)`);
        console.log("Success: true");
        console.log("Tools used:", data.toolsUsed?.length || 0, data.toolsUsed);
        if (data.debugSummary) {
          console.log("Debug Summary:", data.debugSummary);
        }
        if (data.debugEvents) {
          console.log("Debug Events:", data.debugEvents);
        }
        console.groupEnd();
      }

      // Atualizar sessionId se for nova sessão
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Check if request was aborted
      if (err instanceof Error && err.name === "AbortError") {
        const duration = Date.now() - startTime;
        const wasTimeout = duration >= REQUEST_TIMEOUT_MS - 100; // Allow small margin

        if (debugEnabled) {
          console.log(`[ASSISTANT_DEBUG][requestId=${requestId}] Request ${wasTimeout ? 'timed out' : 'aborted'} after ${duration}ms`);
        }

        // Only show error message if it was a timeout (not user-initiated abort)
        if (wasTimeout) {
          const timeoutMessage: Message = {
            id: `timeout-${Date.now()}`,
            role: "assistant",
            content: "A solicitação demorou muito e foi cancelada. Por favor, tente novamente com uma pergunta mais simples.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, timeoutMessage]);
        }
        return;
      }

      const errorMsg = err instanceof Error ? err.message : "Erro ao processar mensagem";
      setError(errorMsg);

      // Debug logging for errors
      if (debugEnabled) {
        const duration = Date.now() - startTime;
        console.groupCollapsed(`[ASSISTANT_DEBUG][requestId=${requestId}] Error (${duration}ms)`);
        console.error("Error:", errorMsg);
        console.groupEnd();
      }

      // Map error messages to user-friendly versions
      let userMessage = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.";

      if (errorMsg.includes("Limite de requisições") || errorMsg.includes("rate limit")) {
        // Extract reset time if available
        const match = errorMsg.match(/(\d+)\s*segundos?/);
        const resetTime = match ? match[1] : "alguns";
        userMessage = `Você está enviando mensagens muito rápido. Aguarde ${resetTime} segundos e tente novamente.`;
      } else if (errorMsg.includes("temporariamente indisponível")) {
        userMessage = "O assistente está temporariamente indisponível. Por favor, tente novamente em alguns instantes.";
      } else if (errorMsg.includes("Mensagem muito longa")) {
        userMessage = "Sua mensagem é muito longa. Por favor, tente uma mensagem mais curta (máximo 10.000 caracteres).";
      } else if (errorMsg.includes("não disponível") || errorMsg.includes("NOT_CONFIGURED")) {
        userMessage = "O assistente não está configurado no momento. Entre em contato com o suporte.";
      }

      // Mostrar mensagem de erro como resposta do assistente
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: userMessage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      // Always clear timeout to prevent memory leak
      clearTimeout(timeoutId);
      setIsTyping(false);
      setIsSending(false);
      // Clear abort controller reference
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Não renderiza se não estiver montado ou se deve esconder
  if (!mounted || shouldHide) return null;

  const chatContent = (
    <>
      {/* Launcher Button */}
      <button
        id="assistant-chat-launcher"
        type="button"
        className={cn(styles.launcher, isOpen && styles.launcherOpen)}
        onClick={handleToggle}
        aria-label={isOpen ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={isOpen}
        aria-controls="assistant-chat-panel"
      >
        <Badge count={0} offset={[-4, 4]}>
          <div className={styles.launcherInner}>
            {isOpen ? (
              <CloseOutlined className={styles.launcherIcon} />
            ) : (
              <MessageOutlined className={styles.launcherIcon} />
            )}
          </div>
        </Badge>
      </button>

      {/* Chat Panel */}
      <div
        id="assistant-chat-panel"
        ref={panelRef}
        className={cn(styles.panel, isOpen && styles.panelOpen)}
        role="dialog"
        aria-label="Chat com assistente"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <Avatar
              size={36}
              icon={<RobotOutlined />}
              className={styles.avatar}
            />
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>Assistente</span>
              <span className={styles.headerStatus}>Online</span>
            </div>
          </div>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setIsOpen(false)}
            aria-label="Fechar chat"
            className={styles.closeButton}
          />
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                styles.message,
                message.role === "user" ? styles.messageUser : styles.messageAssistant
              )}
            >
              {message.role === "assistant" && (
                <Avatar
                  size={28}
                  icon={<RobotOutlined />}
                  className={styles.messageAvatar}
                />
              )}
              <div className={styles.messageBubble}>
                <p className={styles.messageContent}>{message.content}</p>
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className={styles.toolsUsed}>
                    <ToolOutlined style={{ fontSize: 10, marginRight: 4 }} />
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      {message.toolsUsed.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className={cn(styles.message, styles.messageAssistant)}>
              <Avatar
                size={28}
                icon={<RobotOutlined />}
                className={styles.messageAvatar}
              />
              <div className={styles.messageBubble}>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={styles.inputArea}>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            className={styles.input}
            disabled={isTyping}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping || isSending}
            aria-label="Enviar mensagem"
            className={styles.sendButton}
          />
        </div>
      </div>
    </>
  );

  // Usa portal para garantir z-index correto sobre modais
  return createPortal(
    <div className={styles.container}>{chatContent}</div>,
    document.body
  );
}

/**
 * AssistantChat - Botão flutuante + painel de chat do assistente
 *
 * Features:
 * - Botão fixo no canto inferior direito
 * - Painel de chat com animação
 * - Responsivo (drawer em mobile)
 * - Acessível (aria-labels, foco, ESC para fechar)
 * - Debug mode via ?assistantDebug=1
 * - Anti-double-submit
 * - Request tracing com requestId
 */
export function AssistantChat() {
  return (
    <Suspense fallback={null}>
      <AssistantChatInner />
    </Suspense>
  );
}
