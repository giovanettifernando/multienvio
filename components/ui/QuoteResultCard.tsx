"use client";

import { Button, Card, Flex, Space, Tag, Typography } from "antd";

export type QuoteResult = {
  id: string;
  serviceCode: string;
  name: string;
  carrier: "Correios" | "Jadlog" | "Loggi" | "J&T";
  etaDays: number;
  etaRange?: [number, number];
  price: number;
  badges: string[];
  breakdown: {
    base: number;
    adjustments: Array<{ label: string; value: number }>;
    final: number;
  };
  estimatedDelivery: string;
};

type QuoteResultCardProps = {
  result: QuoteResult;
  onDetails?: (result: QuoteResult) => void;
  onGenerate?: (result: QuoteResult) => void;
  highlighted?: boolean;
  showInsuranceLabel?: boolean;
};

const carrierStyles: Record<
  QuoteResult["carrier"],
  { color: string; textColor: string }
> = {
  Correios: { color: "#FFD43B", textColor: "#1F1F1F" },
  Jadlog: { color: "#9067F6", textColor: "#FFFFFF" },
  Loggi: { color: "#F25F5C", textColor: "#FFFFFF" },
  "J&T": { color: "#111827", textColor: "#FFFFFF" },
};

export function QuoteResultCard({
  result,
  onDetails,
  onGenerate,
  highlighted,
  showInsuranceLabel,
}: QuoteResultCardProps) {
  const estimatedDate = new Date(result.estimatedDelivery);
  const estimatedText = estimatedDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  const etaLabel = result.etaRange
    ? `${result.etaRange[0]}-${result.etaRange[1]} dias`
    : `${result.etaDays} dias`;

  const carrierVisual = carrierStyles[result.carrier] ?? carrierStyles.Correios;

  return (
    <Card
      bodyStyle={{ padding: 16 }}
      style={{
        borderRadius: 8,
        border: highlighted ? "2px solid #1677FF" : "1px solid #E5E6EB",
        boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Flex align="center" wrap gap={24}>
        <Flex align="center" gap={12} style={{ minWidth: 180 }}>
          <Tag
            color={carrierVisual.color}
            style={{
              color: carrierVisual.textColor,
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: 999,
            }}
          >
            {result.carrier}
          </Tag>
          <Typography.Text strong>{result.name}</Typography.Text>
        </Flex>

        <Flex
          vertical
          gap={4}
          style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
        >
          <Space size={6} wrap>
            {result.badges.map((badge) => (
              <Tag key={badge} bordered={false} color="blue">
                {badge}
              </Tag>
            ))}
          </Space>
        </Flex>

        <Flex vertical gap={2} style={{ minWidth: 120 }}>
          <Typography.Text strong>{etaLabel}</Typography.Text>
          <Typography.Text type="secondary">
            até {estimatedText}
          </Typography.Text>
        </Flex>

        <Flex
          vertical
          gap={8}
          align="flex-end"
          style={{ minWidth: 160, flex: 1 }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {result.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </Typography.Title>
          {showInsuranceLabel ? (
            <Typography.Text type="secondary">com seguro</Typography.Text>
          ) : null}
          <Space>
            <Button onClick={() => onDetails?.(result)}>Detalhes</Button>
            <Button type="primary" onClick={() => onGenerate?.(result)}>
              Gerar etiqueta
            </Button>
          </Space>
        </Flex>
      </Flex>
    </Card>
  );
}
