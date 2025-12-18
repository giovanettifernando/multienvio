"use client";

import { Button, Card, Space, Typography } from "antd";
import type { CardMethod } from '@/shared/types/billing';

type Props = {
  method: CardMethod;
  onSetDefault?: (id: string) => void;
  onRemove?: (id: string) => void;
};

const BRAND_LABEL: Record<CardMethod["brand"], string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  elo: "Elo",
  hiper: "Hiper",
  other: "Cartão",
};

export function PaymentMethodCard({ method, onSetDefault, onRemove }: Props) {
  return (
    <Card variant="borderless">
      <Space orientation="vertical" size={4} style={{ width: "100%" }}>
        <Typography.Text strong>
          {BRAND_LABEL[method.brand]} •••• {method.last4}
        </Typography.Text>
        <Typography.Text type="secondary">
          {"Validade "}
          {String(method.expMonth).padStart(2, "0")}/{method.expYear}
        </Typography.Text>
        <Typography.Text type="secondary">Titular: {method.holder}</Typography.Text>
        <Space>
          {!method.isDefault ? (
            <Button size="small" onClick={() => onSetDefault?.(method.id)}>
              Definir como padrão
            </Button>
          ) : (
            <Typography.Text type="success">Padrão</Typography.Text>
          )}
          <Button danger size="small" onClick={() => onRemove?.(method.id)}>
            Remover
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
