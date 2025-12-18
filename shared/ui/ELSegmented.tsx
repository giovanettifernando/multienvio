import { Segmented } from 'antd';
import type { SegmentedProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELSegmented.module.css";

/**
 * ELSegmented - Design System v2
 * Wrapper para Segmented do AntD com estilos padronizados
 */
export type ELSegmentedVariant = "default" | "pill" | "block";

export interface ELSegmentedProps<T = string> extends Omit<SegmentedProps<T>, 'block'> {
  variant?: ELSegmentedVariant;
}

export function ELSegmented<T extends string | number = string>({
  variant = "default",
  className,
  size,
  ...props
}: ELSegmentedProps<T>) {
  const variantClass =
    variant === "pill"
      ? styles.segmentedPill
      : variant === "block"
      ? styles.segmentedBlock
      : styles.segmentedDefault;

  return (
    <Segmented
      {...props}
      block={variant === "block"}
      className={cn(styles.segmented, variantClass, className)}
      size={size ?? "middle"}
    />
  );
}
