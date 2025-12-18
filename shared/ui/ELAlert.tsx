"use client";

import { CloseOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { cn } from "@/shared/utils/cn";
import styles from "./ELAlert.module.css";

export type AlertVariant = "success" | "warning" | "danger" | "info" | "error";

export interface ELAlertProps {
  /** Variante de cor */
  variant?: AlertVariant;
  /** Alias para variant (compatibilidade com AntD) */
  type?: AlertVariant;
  /** Título do alerta */
  title?: React.ReactNode;
  /** Alias para title (compatibilidade com AntD) */
  message?: React.ReactNode;
  /** Descrição/conteúdo do alerta */
  description?: React.ReactNode;
  /** Mostrar ícone */
  showIcon?: boolean;
  /** Ícone customizado */
  icon?: React.ReactNode;
  /** Mostrar botão de fechar */
  closable?: boolean;
  /** Callback ao fechar */
  onClose?: () => void;
  /** Ações adicionais */
  actions?: React.ReactNode;
  /** Modo banner (full width) */
  banner?: boolean;
  /** Modo compacto */
  compact?: boolean;
  /** Classe customizada */
  className?: string;
  /** Estilo customizado */
  style?: React.CSSProperties;
}

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  warning: <WarningOutlined />,
  danger: <ExclamationCircleOutlined />,
  error: <ExclamationCircleOutlined />,
  info: <InfoCircleOutlined />,
};

/**
 * ELAlert - Componente de alerta padronizado usando tokens CSS
 *
 * Features:
 * - Variantes de cor consistentes com design system
 * - Ícones padrão por variante
 * - Suporte a ações
 * - Modo banner e compacto
 */
export function ELAlert({
  variant,
  type,
  title,
  message,
  description,
  showIcon = true,
  icon,
  closable = false,
  onClose,
  actions,
  banner = false,
  compact = false,
  className,
  style,
}: ELAlertProps) {
  // Suportar aliases (type → variant, message → title)
  const effectiveVariant = variant ?? type ?? "info";
  // Map "error" to "danger" for consistent styling
  const normalizedVariant = effectiveVariant === "error" ? "danger" : effectiveVariant;
  const effectiveTitle = title ?? message;

  const alertIcon = icon ?? defaultIcons[effectiveVariant];

  return (
    <div
      className={cn(
        styles.alert,
        styles[normalizedVariant],
        banner && styles.banner,
        compact && styles.compact,
        className
      )}
      style={style}
      role="alert"
    >
      {showIcon && <span className={styles.icon}>{alertIcon}</span>}

      <div className={styles.content}>
        {effectiveTitle && <div className={styles.title}>{effectiveTitle}</div>}
        {description && <div className={styles.description}>{description}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {closable && (
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Fechar alerta"
        >
          <CloseOutlined />
        </button>
      )}
    </div>
  );
}
