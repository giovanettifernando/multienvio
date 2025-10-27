import type { ButtonProps } from "antd/es/button";
import Button from "antd/es/button";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
import { cn } from "@/lib/utils/cn";
import styles from "./ELButton.module.css";

export type ELButtonVariant = "primary" | "default" | "link";

export interface ELButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: ELButtonVariant;
}

export function ELButton({
  variant = "default",
  className,
  type,
  ...props
}: ELButtonProps) {
  if (!NEW_THEME_ENABLED) {
    const fallbackType =
      variant === "primary"
        ? "primary"
        : variant === "link"
        ? "link"
        : type;

    return <Button {...props} className={className} type={fallbackType} />;
  }

  const computedType =
    variant === "primary" ? "primary" : variant === "link" ? "link" : "default";

  const variantClass =
    variant === "primary"
      ? styles.buttonPrimary
      : variant === "link"
      ? styles.buttonLink
      : styles.buttonDefault;

  return (
    <Button
      {...props}
      type={computedType}
      className={cn(styles.button, variantClass, className)}
    />
  );
}
