"use client";

import { Card, Space, Tag, Typography } from "antd";

type LabelPreviewProps = {
  carrier: string;
  modalidade: string;
  prazoDias: number;
  preco: number;
  lembrete?: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function LabelPreview({
  carrier,
  modalidade,
  prazoDias,
  preco,
  lembrete,
}: LabelPreviewProps) {
  return (
    <Card size="small" title="Resumo do serviço">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Typography.Text type="secondary">Transportadora</Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {carrier}
          </Typography.Title>
          <Typography.Text>{modalidade}</Typography.Text>
        </div>

        <div>
          <Typography.Text type="secondary">Prazo estimado</Typography.Text>
          <Typography.Title level={5} style={{ margin: "4px 0" }}>
            {prazoDias === 1 ? "1 dia útil" : `${prazoDias} dias úteis`}
          </Typography.Title>
        </div>

        <div>
          <Typography.Text type="secondary">Preço</Typography.Text>
          <Typography.Title level={4} style={{ margin: "4px 0" }}>
            {currency.format(preco)}
          </Typography.Title>
        </div>

        {lembrete ? (
          <div>
            <Typography.Text type="secondary">Lembrete</Typography.Text>
            <br />
            <Tag color="geekblue">{lembrete}</Tag>
          </div>
        ) : null}
      </Space>
    </Card>
  );
}
