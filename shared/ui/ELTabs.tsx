import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELTabs.module.css";

/**
 * ELTabs - Design System v2
 * Wrapper para Tabs do AntD com estilos padronizados
 */
export type ELTabsVariant = "default" | "card" | "line";

export interface ELTabsProps extends TabsProps {
  variant?: ELTabsVariant;
}

export function ELTabs({
  variant = "default",
  className,
  size,
  ...props
}: ELTabsProps) {
  const variantClass =
    variant === "card"
      ? styles.tabsCard
      : variant === "line"
      ? styles.tabsLine
      : styles.tabsDefault;

  return (
    <Tabs
      {...props}
      type={variant === "card" ? "card" : "line"}
      className={cn(styles.tabs, variantClass, className)}
      size={size ?? "middle"}
    />
  );
}
