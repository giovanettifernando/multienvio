import type { CardProps } from "antd/es/card";
import Card from "antd/es/card";
import Typography from "antd/es/typography";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { spacing } from "@/lib/ui/theme";
import styles from "./ELCard.module.css";

type HeaderConfig = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
};

export interface ELCardProps extends Omit<CardProps, 'bodyStyle'> {
  header?: HeaderConfig;
  padding?: keyof typeof spacing;
  bodyGap?: keyof typeof spacing;
}

export function ELCard({
  header,
  padding = "lg",
  bodyGap = "md",
  className,
  children,
  ...cardProps
}: ELCardProps) {
  const { styles: cardStyles, ...restCardProps } = cardProps;
  const paddingValue = spacing[padding] ?? spacing.lg;
  const gapValue = spacing[bodyGap] ?? spacing.md;

  // Extract body style if cardStyles is an object (not a function)
  const existingBodyStyle = typeof cardStyles === 'object' && cardStyles !== null && 'body' in cardStyles
    ? (cardStyles as { body?: React.CSSProperties }).body
    : {};

  const mergedBodyStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: `${gapValue}px`,
    padding: `${paddingValue}px`,
    ...existingBodyStyle,
  };

  const mergedStyles = {
    ...(typeof cardStyles === 'object' ? cardStyles : {}),
    body: mergedBodyStyle,
  };

  return (
    <Card
      {...restCardProps}
      title={undefined}
      extra={undefined}
      className={cn(styles.card, className)}
      styles={mergedStyles}
    >
      {header ? (
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Typography.Title level={3} className={styles.headerTitle}>
              {header.title}
            </Typography.Title>
            {header.description ? (
              <Typography.Paragraph className={styles.headerDescription}>
                {header.description}
              </Typography.Paragraph>
            ) : null}
          </div>
          {header.extra ? (
            <div className={styles.headerExtra}>{header.extra}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}
