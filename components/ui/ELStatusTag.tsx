"use client";

import { cn } from "@/lib/utils/cn";
import styles from "./ELStatusTag.module.css";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "processing" | "default";
export type StatusSize = "small" | "default" | "large";

export interface ELStatusTagProps {
  /** Texto do status */
  children: React.ReactNode;
  /** Variante de cor */
  variant?: StatusVariant;
  /** Tamanho */
  size?: StatusSize;
  /** Mostrar indicador de ponto */
  showDot?: boolean;
  /** Classe customizada */
  className?: string;
}

/**
 * ELStatusTag - Tag de status unificada usando tokens CSS
 *
 * Variantes disponíveis:
 * - success: Verde para estados positivos (Entregue, Resolvido, etc)
 * - warning: Laranja para alertas (Atrasado, Pendente, etc)
 * - danger: Vermelho para erros (Falha, Cancelado, etc)
 * - info: Azul para informação
 * - processing: Azul escuro para em andamento
 * - default: Cinza para neutro
 */
export function ELStatusTag({
  children,
  variant = "default",
  size = "default",
  showDot = false,
  className,
}: ELStatusTagProps) {
  const variantClass = styles[variant];
  const sizeClass = size !== "default" ? styles[size] : undefined;

  return (
    <span className={cn(styles.tag, variantClass, sizeClass, className)}>
      {showDot && <span className={styles.dot} />}
      {children}
    </span>
  );
}

/**
 * Helper para mapear cores do Ant Design para variantes do ELStatusTag
 */
export function antColorToVariant(color: string): StatusVariant {
  const mapping: Record<string, StatusVariant> = {
    success: "success",
    green: "success",
    warning: "warning",
    orange: "warning",
    error: "danger",
    red: "danger",
    blue: "info",
    processing: "processing",
    purple: "info",
    default: "default",
    gray: "default",
  };
  return mapping[color] || "default";
}
