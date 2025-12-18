/**
 * PageHeader - Componente de cabeçalho reutilizável
 */
import React from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@/shared/ui/theme";

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
  style?: React.CSSProperties;
}

export function PageHeader({
  title,
  description,
  extra,
  style,
}: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" wrap="wrap" gap={spacing.md} style={style}>
      <Flex vertical gap={spacing.xs}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description && (
          <Typography.Text type="secondary">{description}</Typography.Text>
        )}
      </Flex>
      {extra && <div>{extra}</div>}
    </Flex>
  );
}
