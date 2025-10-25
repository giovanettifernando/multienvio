"use client";

import { PropsWithChildren } from "react";
import { Card, Flex, Typography } from "antd";

type MetricCardProps = PropsWithChildren<{
  titulo: string;
  descricao?: string;
  destaque: string;
  tonalidade?: "primary" | "success" | "warning" | "danger";
}>;

const tonalidades: Record<
  NonNullable<MetricCardProps["tonalidade"]>,
  { bg: string; color: string }
> = {
  primary: { bg: "#e6f0fb", color: "#0b3b73" },
  success: { bg: "#edf9f1", color: "#2c9b5c" },
  warning: { bg: "#fff7e6", color: "#f59e0b" },
  danger: { bg: "#fdecec", color: "#d64545" },
};

export function MetricCard({
  titulo,
  descricao,
  destaque,
  tonalidade = "primary",
  children,
}: MetricCardProps) {
  const palette = tonalidades[tonalidade];

  return (
    <Card
      variant="borderless"
      style={{
        backgroundColor: "#fff",
        boxShadow:
          "0 12px 24px -16px rgba(11, 59, 115, 0.35)",
      }}
    >
      <Flex vertical gap={16}>
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">
            {titulo}
          </Typography.Text>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {destaque}
          </Typography.Title>
        </Flex>

        {descricao ? (
          <Typography.Paragraph
            style={{ margin: 0, color: "rgba(0,0,0,0.65)" }}
          >
            {descricao}
          </Typography.Paragraph>
        ) : null}

        {children ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              backgroundColor: palette.bg,
              color: palette.color,
              fontWeight: 500,
            }}
          >
            {children}
          </div>
        ) : null}
      </Flex>
    </Card>
  );
}
