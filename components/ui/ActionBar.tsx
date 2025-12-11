"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { Dropdown, type MenuProps } from "antd";
import { MoreOutlined, FilterOutlined } from "@ant-design/icons";
import { ELButton } from "./ELButton";
import styles from "./ActionBar.module.css";

export interface ActionBarProps {
  /** Elementos filho (filtros, botões, etc) */
  children: React.ReactNode;
  /** Classe CSS adicional */
  className?: string;
  /** Variante de layout */
  variant?: "default" | "compact" | "inline";
  /** Ações extras que colapsam em dropdown no mobile */
  extraActions?: {
    key: string;
    label: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
  /** Label do dropdown de ações extras */
  extraActionsLabel?: string;
  /** Gap entre elementos */
  gap?: "sm" | "md" | "lg";
}

/**
 * ActionBar - Barra de filtros e ações responsiva
 *
 * Características:
 * - Wrap automático em telas menores
 * - Colapsa ações extras em dropdown em mobile
 * - Variante compacta para 1366x768
 * - Usa tokens CSS para espaçamento
 */
export function ActionBar({
  children,
  className,
  variant = "default",
  extraActions,
  extraActionsLabel = "Ações",
  gap = "md",
}: ActionBarProps) {
  // Converte extraActions para MenuProps
  const menuItems: MenuProps["items"] = extraActions?.map((action) => ({
    key: action.key,
    label: action.label,
    icon: action.icon,
    onClick: action.onClick,
    danger: action.danger,
    disabled: action.disabled,
  }));

  return (
    <div
      className={cn(
        styles.actionBar,
        styles[`variant-${variant}`],
        styles[`gap-${gap}`],
        className
      )}
    >
      <div className={styles.content}>{children}</div>

      {extraActions && extraActions.length > 0 && (
        <>
          {/* Ações inline para desktop */}
          <div className={styles.extraActionsDesktop}>
            {extraActions.map((action) => (
              <ELButton
                key={action.key}
                variant={action.danger ? "danger" : "default"}
                icon={action.icon}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </ELButton>
            ))}
          </div>

          {/* Dropdown para mobile */}
          <div className={styles.extraActionsMobile}>
            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <ELButton variant="default" icon={<MoreOutlined />}>
                {extraActionsLabel}
              </ELButton>
            </Dropdown>
          </div>
        </>
      )}
    </div>
  );
}

export interface FilterGroupProps {
  /** Elementos filho (inputs, selects, etc) */
  children: React.ReactNode;
  /** Classe CSS adicional */
  className?: string;
  /** Se deve colapsar em linha única no mobile */
  collapsible?: boolean;
  /** Label do grupo quando colapsado */
  collapseLabel?: string;
}

/**
 * FilterGroup - Grupo de filtros com colapso opcional
 */
export function FilterGroup({
  children,
  className,
  collapsible = false,
  collapseLabel = "Filtros",
}: FilterGroupProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  if (!collapsible) {
    return (
      <div className={cn(styles.filterGroup, className)}>{children}</div>
    );
  }

  return (
    <div className={cn(styles.filterGroup, styles.collapsible, className)}>
      {/* Botão de colapso para mobile */}
      <div className={styles.collapseToggle}>
        <ELButton
          variant="ghost"
          icon={<FilterOutlined />}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {collapseLabel}
        </ELButton>
      </div>

      {/* Conteúdo que colapsa */}
      <div
        className={cn(
          styles.collapseContent,
          isCollapsed && styles.collapsed
        )}
      >
        {children}
      </div>

      {/* Conteúdo sempre visível no desktop */}
      <div className={styles.desktopContent}>{children}</div>
    </div>
  );
}

export default ActionBar;
