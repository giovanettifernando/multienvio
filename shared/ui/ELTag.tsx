import { Tag } from 'antd';
import type { TagProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELTag.module.css";

export type ELTagStatus = "default" | "success" | "warning" | "warning-solid" | "danger" | "info";

export interface ELTagProps extends TagProps {
  status?: ELTagStatus;
}

export function ELTag({
  status = "default",
  className,
  ...props
}: ELTagProps) {
  const statusClass =
    status === "success"
      ? styles.tagSuccess
      : status === "warning"
      ? styles.tagWarning
      : status === "warning-solid"
      ? styles.tagWarningSolid
      : status === "danger"
      ? styles.tagDanger
      : status === "info"
      ? styles.tagInfo
      : styles.tagDefault;

  return (
    <Tag {...props} className={cn(styles.tag, statusClass, className)} />
  );
}
