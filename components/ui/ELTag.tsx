import type { TagProps } from "antd/es/tag";
import Tag from "antd/es/tag";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
import { cn } from "@/lib/utils/cn";
import styles from "./ELTag.module.css";

export type ELTagStatus = "default" | "success" | "warning" | "danger" | "info";

export interface ELTagProps extends TagProps {
  status?: ELTagStatus;
}

export function ELTag({
  status = "default",
  className,
  ...props
}: ELTagProps) {
  if (!NEW_THEME_ENABLED) {
    return <Tag {...props} className={className} />;
  }

  const statusClass =
    status === "success"
      ? styles.tagSuccess
      : status === "warning"
      ? styles.tagWarning
      : status === "danger"
      ? styles.tagDanger
      : status === "info"
      ? styles.tagInfo
      : styles.tagDefault;

  return (
    <Tag {...props} className={cn(styles.tag, statusClass, className)} />
  );
}
