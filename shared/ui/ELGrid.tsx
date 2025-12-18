/**
 * ELGrid - Sistema de grid padronizado
 *
 * Wrapper semântico para layouts de grid usando CSS Grid.
 * Substitui o uso direto de Row/Col do AntD por classes CSS padronizadas.
 */

import React from "react";
import styles from "./ELGrid.module.css";

export type GridVariant =
  | "2"          // 2 colunas iguais
  | "3"          // 3 colunas iguais
  | "4"          // 4 colunas iguais
  | "auto"       // Auto-fill responsivo
  | "sidebar"    // Layout 1.1:1.4 para sidebar
  | "dashboard"  // Layout 2:1 para dashboard
  | "cart"       // Layout 2:1 para carrinho (ordem reversa no mobile)
  | "finalizar"  // Layout 10/8/6 para tela de finalizar (3 itens)
  | "forms";     // Layout 14/10 para formulários lado a lado

export type GapSize = "sm" | "md" | "lg" | "xl";

export interface ELGridProps {
  /** Layout do grid */
  variant?: GridVariant;
  /** Tamanho do espaçamento */
  gap?: GapSize;
  /** Conteúdo do grid */
  children: React.ReactNode;
  /** Classes CSS adicionais */
  className?: string;
  /** Estilo inline adicional */
  style?: React.CSSProperties;
}

const variantClassMap: Record<GridVariant, string> = {
  "2": styles.grid2,
  "3": styles.grid3,
  "4": styles.grid4,
  "auto": styles.gridAuto,
  "sidebar": styles.gridSidebar,
  "dashboard": styles.gridDashboard,
  "cart": styles.gridCart,
  "finalizar": styles.gridFinalizar,
  "forms": styles.gridForms,
};

const gapClassMap: Record<GapSize, string> = {
  "sm": styles.gapSm,
  "md": styles.gapMd,
  "lg": styles.gapLg,
  "xl": styles.gapXl,
};

/**
 * Container de grid responsivo
 */
export function ELGrid({
  variant = "2",
  gap = "md",
  children,
  className,
  style,
}: ELGridProps) {
  const classes = [
    styles.grid,
    variantClassMap[variant],
    gapClassMap[gap],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

/**
 * Item que ocupa toda a largura do grid
 */
export function ELGridSpanFull({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const classes = [styles.spanFull, className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

/**
 * Item que ocupa 2 colunas do grid
 */
export function ELGridSpan2({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const classes = [styles.span2, className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

/**
 * Container flex com gap padronizado
 */
export function ELFlex({
  direction = "row",
  align,
  justify,
  gap = "md",
  wrap = true,
  children,
  className,
  style,
}: {
  direction?: "row" | "col";
  align?: "center" | "start" | "end";
  justify?: "center" | "between" | "end" | "start";
  gap?: GapSize;
  wrap?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const classes = [
    styles.flex,
    direction === "col" ? styles.flexCol : styles.flexRow,
    align === "center" && styles.flexCenter,
    justify === "between" && styles.flexBetween,
    justify === "end" && styles.flexEnd,
    gapClassMap[gap],
    !wrap && "flex-nowrap",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
