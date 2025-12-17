"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Olá! Sou o assistente virtual do Envio Legal. Como posso ajudar você hoje?",
    timestamp: new Date(),
  },
];

/**
 * AssistantChat - Botão flutuante + painel de chat do assistente
 *
 * Features:
 * - Botão fixo no canto inferior direito
 * - Painel de chat com animação
 * - Responsivo (drawer em mobile)
 * - Acessível (aria-labels, foco, ESC para fechar)
 */
export function AssistantChat() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Verifica se deve esconder o assistente
  const shouldHide = !user || HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));

  // Garante que só renderiza no client (para createPortal)
  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: sessionId || undefined,
          includeHistory: true,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || json.error || "Erro ao processar mensagem");
      }

      const data: ChatResponse = json.data ?? json;

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
      setError(err instanceof Error ? err.message : "Erro ao processar mensagem");

      // Mostrar mensagem de erro como resposta do assistente
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
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
            disabled={!inputValue.trim() || isTyping}
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

