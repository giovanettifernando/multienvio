/**
 * PageShell - Wrapper padrão para páginas com header e ações
 *
 * Comportamento:
 * - Faixa azul fixa no topo da área de conteúdo (sticky)
 * - Fundo azul (primary) com texto branco para destaque
 * - Sem subtítulos/descrições (removidos para simplicidade)
 * - A faixa permanece fixa; apenas o conteúdo abaixo rola
 * - Ocupa toda a largura do container de conteúdo
 */
import React from "react";
import { cn } from "@/lib/utils/cn";
import styles from "./PageShell.module.css";

type GapSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

interface PageShellProps {
  title?: string;
  /** @deprecated Subtítulos foram removidos do padrão. Use apenas o título. */
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  gap?: GapSize;
  style?: React.CSSProperties;
  className?: string;
}

const gapClasses: Record<GapSize, string> = {
  xs: styles.gapXs,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
  xl: styles.gapXl,
  xxl: styles.gapXxl,
};

export function PageShell({
  title,
  extra,
  children,
  gap = "xl",
  style,
  className,
}: PageShellProps) {
  return (
    <div className={cn(styles.shell, gapClasses[gap], className)} style={style}>
      {(title || extra) && (
        <div className={styles.header}>
          <div className={styles.headerContent}>
            {title && (
              <h3 className={styles.title}>
                {title}
              </h3>
            )}
            {extra && <div className={styles.extra}>{extra}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
