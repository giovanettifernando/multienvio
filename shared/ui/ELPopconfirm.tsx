import { Popconfirm } from 'antd';
import type { PopconfirmProps } from 'antd';
import { ExclamationCircleFilled, QuestionCircleFilled, WarningFilled } from '@ant-design/icons';
import { cn } from "@/shared/utils/cn";
import styles from "./ELPopconfirm.module.css";

/**
 * ELPopconfirm - Design System v2
 * Wrapper para Popconfirm do AntD com estilos padronizados
 * Textos de botões em português por padrão
 */
export type ELPopconfirmVariant = "default" | "danger" | "warning";

export interface ELPopconfirmProps extends Omit<PopconfirmProps, 'icon'> {
  variant?: ELPopconfirmVariant;
}

const variantIcons = {
  default: <QuestionCircleFilled style={{ color: 'var(--el-color-primary)' }} />,
  danger: <ExclamationCircleFilled style={{ color: 'var(--el-color-error)' }} />,
  warning: <WarningFilled style={{ color: 'var(--el-color-warning)' }} />,
};

export function ELPopconfirm({
  variant = "default",
  okText,
  cancelText,
  okButtonProps,
  className,
  ...props
}: ELPopconfirmProps) {
  const icon = variantIcons[variant];

  // Props do botão OK baseadas na variante
  const computedOkButtonProps = {
    ...okButtonProps,
    danger: variant === "danger" ? true : okButtonProps?.danger,
  };

  return (
    <Popconfirm
      {...props}
      icon={icon}
      okText={okText ?? "Confirmar"}
      cancelText={cancelText ?? "Cancelar"}
      okButtonProps={computedOkButtonProps}
      overlayClassName={cn(styles.popconfirm, className)}
    />
  );
}
