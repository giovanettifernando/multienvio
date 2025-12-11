import type { ButtonProps } from "antd/es/button";
import Button from "antd/es/button";
import { cn } from "@/lib/utils/cn";
import styles from "./ELButton.module.css";

/**
 * ELButton - Design System v2
 * Variantes: primary, default, link, danger, ghost, text, dashed, tonal
 */
export type ELButtonVariant = "primary" | "default" | "link" | "danger" | "ghost" | "text" | "dashed" | "tonal";

export interface ELButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: ELButtonVariant;
}

export function ELButton({
  variant = "default",
  className,
  danger,
  ...props
}: ELButtonProps) {
  const computedType =
    variant === "primary"
      ? "primary"
      : variant === "link"
      ? "link"
      : variant === "ghost" || variant === "text" || variant === "tonal"
      ? "text"
      : variant === "dashed"
      ? "dashed"
      : "default";

  const variantClass =
    variant === "primary"
      ? styles.buttonPrimary
      : variant === "link"
      ? styles.buttonLink
      : variant === "danger"
      ? styles.buttonDanger
      : variant === "ghost" || variant === "text"
      ? styles.buttonGhost
      : variant === "tonal"
      ? styles.buttonTonal
      : variant === "dashed"
      ? styles.buttonDashed
      : styles.buttonDefault;

  return (
    <Button
      {...props}
      type={computedType}
      danger={variant === "danger" || danger}
      className={cn(styles.button, variantClass, className)}
    />
  );
}
