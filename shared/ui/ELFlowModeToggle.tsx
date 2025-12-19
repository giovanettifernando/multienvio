"use client";

import { ELSegmented } from './ELSegmented';
import styles from './ELFlowModeToggle.module.css';
import { cn } from "@/shared/utils/cn";

export interface ELFlowModeToggleProps {
  isReverse: boolean;
  onChange: (isReverse: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle discreto para alternar entre Envio e Logística Reversa.
 * Design moderno e sutil que não compete com o conteúdo principal.
 */
export function ELFlowModeToggle({
  isReverse,
  onChange,
  disabled,
  className,
}: ELFlowModeToggleProps) {
  return (
    <div className={cn(styles.container, isReverse && styles.reverse, className)}>
      <ELSegmented
        value={isReverse ? "reversa" : "envio"}
        onChange={(value) => onChange(value === "reversa")}
        disabled={disabled}
        options={[
          { label: "Envio", value: "envio" },
          { label: "Logística Reversa", value: "reversa" },
        ]}
        size="small"
        className={styles.segmented}
      />
    </div>
  );
}
