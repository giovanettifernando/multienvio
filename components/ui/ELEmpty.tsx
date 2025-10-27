import Empty from "antd/es/empty";
import Typography from "antd/es/typography";
import type { EmptyProps } from "antd/es/empty";
import type { ReactNode } from "react";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
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
  title?: ReactNode;
  description?: ReactNode;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
}

export function ELEmpty({
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  image,
  ...emptyProps
}: ELEmptyProps) {
  if (!NEW_THEME_ENABLED) {
    const fallbackDescription = description ?? title ?? undefined;
    return (
      <Empty
        {...emptyProps}
        image={image}
        description={fallbackDescription}
        className={className}
      />
    );
  }

  return (
    <div className={cn(styles.empty, className)}>
      <Empty
        {...emptyProps}
        image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
        description={null}
      />
      {title ? <Typography.Title level={4} className={styles.title}>{title}</Typography.Title> : null}
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
