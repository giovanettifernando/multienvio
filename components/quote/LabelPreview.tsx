"use client";

import { Card, Divider, Space, Typography } from "antd";

type PickupFeeInfo = {
  collectorName: string;
  distanceKm: number;
  feeAmount: number;
};

type LabelPreviewProps = {
  carrier: string;
  modalidade: string;
  prazoDias: number;
  preco: number;
  pickupFee?: PickupFeeInfo | null;
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
  pickupFee,
}: LabelPreviewProps) {
  const hasPickupFee = pickupFee && pickupFee.feeAmount > 0;
  const total = hasPickupFee ? preco + pickupFee.feeAmount : preco;

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
          <Typography.Text type="secondary">Preço do frete</Typography.Text>
          <Typography.Title level={4} style={{ margin: "4px 0" }}>
            {currency.format(preco)}
          </Typography.Title>
        </div>

        {hasPickupFee && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text type="secondary" strong>
                Coleta na origem
              </Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Typography.Text>
                  Coletor: {pickupFee.collectorName}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">
                  Distância: {pickupFee.distanceKm.toFixed(1)} km
                </Typography.Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Typography.Text strong>
                  Taxa de coleta: {currency.format(pickupFee.feeAmount)}
                </Typography.Text>
              </div>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text type="secondary">Total (frete + coleta)</Typography.Text>
              <Typography.Title level={3} style={{ margin: "4px 0", color: "#1890ff" }}>
                {currency.format(total)}
              </Typography.Title>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}
