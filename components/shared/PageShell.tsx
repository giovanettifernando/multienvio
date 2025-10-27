/**
 * PageShell - Wrapper padrão para páginas com header e ações
 */
import React from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@/lib/ui/theme";

interface PageShellProps {
  title?: string;
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  gap?: keyof typeof spacing;
  style?: React.CSSProperties;
}

export function PageShell({
  title,
  description,
  extra,
  children,
  gap = "xl",
  style,
}: PageShellProps) {
  return (
    <Flex vertical gap={spacing[gap]} style={style}>
      {(title || extra) && (
        <Flex justify="space-between" align="center" wrap="wrap" gap={spacing.md}>
          {title && (
            <Flex vertical gap={spacing.xs}>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {title}
              </Typography.Title>
              {description && (
                <Typography.Text type="secondary">{description}</Typography.Text>
              )}
            </Flex>
          )}
          {extra && <div>{extra}</div>}
        </Flex>
      )}
      {children}
    </Flex>
  );
}
