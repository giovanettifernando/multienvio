import { Empty, Typography } from 'antd';
import type { EmptyProps } from 'antd';
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ELButton } from "./ELButton";
import styles from "./ELEmpty.module.css";

type ActionConfig = {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
};

export interface ELEmptyProps
  extends Omit<EmptyProps, "description" | "imageStyle"> {
  /** Título principal */
  title?: ReactNode;
  /** Alias para title (compatibilidade) */
  message?: ReactNode;
  /** Descrição/subtítulo */
  description?: ReactNode;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
}

export function ELEmpty({
  title,
  message,
  description,
  primaryAction,
  secondaryAction,
  className,
  image,
  ...emptyProps
}: ELEmptyProps) {
  // Suportar alias message → title
  const effectiveTitle = title ?? message;

  return (
    <div className={cn(styles.empty, className)}>
      <Empty
        {...emptyProps}
        image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
        description={null}
      />
      {effectiveTitle ? <Typography.Title level={4} className={styles.title}>{effectiveTitle}</Typography.Title> : null}
      {description ? (
        <Typography.Paragraph className={styles.description}>
          {description}
        </Typography.Paragraph>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className={styles.actions}>
          {primaryAction ? (
            <ELButton
              variant="primary"
              onClick={primaryAction.onClick}
              aria-label={primaryAction.ariaLabel ?? primaryAction.label}
            >
              {primaryAction.label}
            </ELButton>
          ) : null}
          {secondaryAction ? (
            <ELButton
              variant="default"
              onClick={secondaryAction.onClick}
              aria-label={secondaryAction.ariaLabel ?? secondaryAction.label}
            >
              {secondaryAction.label}
            </ELButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
