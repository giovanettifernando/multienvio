import { Checkbox } from 'antd';
import type { CheckboxProps, CheckboxGroupProps } from 'antd/es/checkbox';
import { cn } from "@/shared/utils/cn";
import styles from "./ELCheckbox.module.css";

/**
 * ELCheckbox - Design System v2
 * Wrapper para Checkbox do AntD com estilos padronizados
 * Inclui variante Group para múltiplas opções
 */

const { Group } = Checkbox;

export interface ELCheckboxProps extends CheckboxProps {}

export interface ELCheckboxGroupProps extends CheckboxGroupProps {
  direction?: "horizontal" | "vertical";
}

function CheckboxBase({
  className,
  ...props
}: ELCheckboxProps) {
  return (
    <Checkbox
      {...props}
      className={cn(styles.checkbox, className)}
    />
  );
}

function ELCheckboxGroup({
  className,
  direction = "horizontal",
  ...props
}: ELCheckboxGroupProps) {
  const directionClass = direction === "vertical" ? styles.groupVertical : styles.groupHorizontal;

  return (
    <Group
      {...props}
      className={cn(styles.checkboxGroup, directionClass, className)}
    />
  );
}

// Composed component pattern
type ComposedELCheckbox = typeof CheckboxBase & {
  Group: typeof ELCheckboxGroup;
};

export const ELCheckbox = CheckboxBase as ComposedELCheckbox;
ELCheckbox.Group = ELCheckboxGroup;
