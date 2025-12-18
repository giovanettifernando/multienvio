import { Switch } from 'antd';
import type { SwitchProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELSwitch.module.css";

/**
 * ELSwitch - Design System v2
 * Wrapper para Switch do AntD com estilos padronizados
 */
export type ELSwitchVariant = "default" | "success" | "danger";

export interface ELSwitchProps extends SwitchProps {
  variant?: ELSwitchVariant;
  label?: string;
}

export function ELSwitch({
  variant = "default",
  className,
  label,
  ...props
}: ELSwitchProps) {
  const variantClass =
    variant === "success"
      ? styles.switchSuccess
      : variant === "danger"
      ? styles.switchDanger
      : styles.switchDefault;

  const switchElement = (
    <Switch
      {...props}
      className={cn(styles.switch, variantClass, className)}
    />
  );

  if (label) {
    return (
      <label className={styles.switchLabel}>
        {switchElement}
        <span className={styles.labelText}>{label}</span>
      </label>
    );
  }

  return switchElement;
}
