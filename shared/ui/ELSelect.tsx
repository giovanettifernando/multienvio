import { Select } from 'antd';
import type { SelectProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELSelect.module.css";

export function ELSelect<ValueType = unknown>({
  className,
  size,
  popupMatchSelectWidth,
  ...props
}: SelectProps<ValueType>) {
  return (
    <Select
      {...props}
      className={cn(styles.select, className)}
      size={size ?? "middle"}
      showSearch={props.showSearch ?? false}
      popupMatchSelectWidth={popupMatchSelectWidth ?? false}
    />
  );
}
