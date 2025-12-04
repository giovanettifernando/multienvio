import type { ButtonProps } from "antd/es/button";
import Button from "antd/es/button";
import { cn } from "@/lib/utils/cn";
import styles from "./ELButton.module.css";

export type ELButtonVariant = "primary" | "default" | "link" | "danger" | "ghost";

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
      : variant === "ghost"
      ? "text"
      : "default";

  const variantClass =
    variant === "primary"
      ? styles.buttonPrimary
      : variant === "link"
      ? styles.buttonLink
      : variant === "danger"
      ? styles.buttonDanger
      : variant === "ghost"
      ? styles.buttonGhost
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
