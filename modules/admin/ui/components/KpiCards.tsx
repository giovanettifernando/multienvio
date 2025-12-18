"use client";

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { Card, Flex, Space, Tag, Typography } from "antd";
import type { KpiComputation } from "@/modules/admin/application/stats";
import { buildDelta } from "@/modules/admin/application/stats";

type KpiCardsProps = {
  loading?: boolean;
  items: KpiComputation[];
};

function formatValue(item: KpiComputation): string {
  if (item.format === "currency") {
    return item.value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  }
  return item.value.toLocaleString("pt-BR");
}

function renderDelta(item: KpiComputation) {
  const { delta, trend } = buildDelta(item.value, item.previous);
  const badgeColor =
    trend === "up" ? "green" : trend === "down" ? "red" : "default";

  const icon =
    trend === "up" ? (
      <ArrowUpOutlined />
    ) : trend === "down" ? (
      <ArrowDownOutlined />
    ) : (
      <MinusOutlined />
    );

  return (
    <Space size={6}>
      <Tag color={badgeColor} style={{ marginInlineEnd: 0 }}>
        {icon} {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </Tag>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        vs período anterior
      </Typography.Text>
    </Space>
  );
}

export function KpiCards({ items, loading }: KpiCardsProps) {
  return (
    <Flex wrap gap={16}>
      {items.map((item) => (
        <Card
          key={item.key}
          loading={loading}
          variant="outlined"
          styles={{ body: { padding: 16 } }}
          style={{ flex: "1 1 200px", minWidth: 180 }}
        >
          <Space orientation="vertical" size={4}>
            <Typography.Text type="secondary">{item.label}</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {formatValue(item)}
            </Typography.Title>
            {renderDelta(item)}
          </Space>
        </Card>
      ))}
    </Flex>
  );
}
