"use client";

import { ArrowRightOutlined, ArrowDownOutlined } from "@ant-design/icons";
import styles from './ELFlowConnector.module.css';
import { cn } from "@/shared/utils/cn";

export interface ELFlowConnectorProps {
  /** Direção do fluxo invertida (logística reversa) */
  isReverse?: boolean;
  /** Direção do conector: horizontal ou vertical */
  direction?: "horizontal" | "vertical";
  /** Classe CSS adicional */
  className?: string;
}

/**
 * ELFlowConnector - Conector visual discreto entre cards de origem/destino.
 * Mostra a direção do fluxo de forma sutil e integrada.
 */
export function ELFlowConnector({
  isReverse = false,
  direction = "horizontal",
  className,
}: ELFlowConnectorProps) {
  const ArrowIcon = direction === "vertical" ? ArrowDownOutlined : ArrowRightOutlined;

  return (
    <div
      className={cn(
        styles.connector,
        direction === "vertical" && styles.vertical,
        isReverse && styles.reverse,
        className
      )}
      aria-hidden="true"
    >
      <div className={styles.line} />
      <span className={styles.arrow}>
        <ArrowIcon />
      </span>
      <div className={styles.line} />
    </div>
  );
}
