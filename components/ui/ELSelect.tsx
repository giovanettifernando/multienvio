import type { SelectProps } from "antd/es/select";
import Select from "antd/es/select";
import { cn } from "@/lib/utils/cn";
import styles from "./ELSelect.module.css";

export function ELSelect<ValueType = unknown>({
  className,
  size,
  ...props
}: SelectProps<ValueType>) {
  return (
    <Select
      {...props}
      className={cn(styles.select, className)}
      size={size ?? "large"}
      showSearch={props.showSearch ?? false}
    />
  );
}
