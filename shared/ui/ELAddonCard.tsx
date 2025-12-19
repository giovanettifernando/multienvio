"use client";

import type { ReactNode } from "react";
import styles from "./ELAddonCard.module.css";
import { cn } from "@/shared/utils/cn";

export interface ELAddonCardProps {
  /** Estado atual (ativado/desativado) */
  checked: boolean;
  /** Callback de mudança */
  onChange: (checked: boolean) => void;
  /** Desabilita o controle */
  disabled?: boolean;
  /** Título principal */
  title: string;
  /** Descrição secundária (opcional) */
  description?: string;
  /** Ícone à esquerda */
  icon?: ReactNode;
  /** Label quando ativado */
  checkedLabel?: string;
  /** Label quando desativado */
  uncheckedLabel?: string;
  /** Dica quando desabilitado */
  disabledHint?: string;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * ELAddonCard - Card de serviço opcional estilo "add-on de checkout"
 * Design moderno e discreto para toggles de serviços adicionais.
 */
export function ELAddonCard({
  checked,
  onChange,
  disabled = false,
  title,
  description,
  icon,
  checkedLabel = "Adicionado",
  uncheckedLabel = "Adicionar",
  disabledHint,
  className,
}: ELAddonCardProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        styles.card,
        checked && styles.checked,
        disabled && styles.disabled,
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.content}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <div className={styles.text}>
          <span className={styles.title}>{title}</span>
          {description && (
            <span className={styles.description}>
              {disabled && disabledHint ? disabledHint : description}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className={cn(styles.button, checked && styles.buttonChecked)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      >
        {checked ? checkedLabel : uncheckedLabel}
      </button>
    </div>
  );
}
