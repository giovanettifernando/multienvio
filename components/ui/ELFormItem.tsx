import type { FormItemProps } from "antd/es/form";
import Form from "antd/es/form";
import { cn } from "@/lib/utils/cn";
import styles from "./ELFormItem.module.css";

export function ELFormItem({
  className,
  labelAlign,
  colon,
  labelCol,
  required,
  ...props
}: FormItemProps) {
  return (
    <Form.Item
      {...props}
      required={required}
      labelAlign={labelAlign ?? "left"}
      colon={colon ?? false}
      labelCol={labelCol ?? { span: 24 }}
      className={cn(styles.formItem, className)}
    />
  );
}
