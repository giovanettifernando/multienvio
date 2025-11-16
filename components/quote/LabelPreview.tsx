"use client";

import { Card, Divider, Space, Typography, Spin } from "antd";

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
  isLoadingPickupFee?: boolean;
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
  isLoadingPickupFee = false,
}: LabelPreviewProps) {
  // Debug logging
  console.log('[LABEL_PREVIEW] Props received:', JSON.stringify({
    carrier,
    modalidade,
    prazoDias,
    preco,
    pickupFee,
    isLoadingPickupFee,
  }, null, 2));

  const hasPickupFee = pickupFee && pickupFee.feeAmount > 0;
  const total = hasPickupFee ? preco + pickupFee.feeAmount : preco;

  console.log('[LABEL_PREVIEW] Computed values:', JSON.stringify({
    hasPickupFee,
    total,
  }, null, 2));

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

        {isLoadingPickupFee && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spin size="small" />
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Calculando taxa de coleta...
              </Typography.Text>
            </div>
          </>
        )}

        {!isLoadingPickupFee && hasPickupFee && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text type="secondary">Taxa de coleta</Typography.Text>
              <Typography.Title level={5} style={{ margin: "4px 0" }}>
                {currency.format(pickupFee.feeAmount)}
              </Typography.Title>
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
