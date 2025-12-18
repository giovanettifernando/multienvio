import { Form } from 'antd';
import type { FormItemProps } from 'antd';
import { cn } from "@/shared/utils/cn";
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
