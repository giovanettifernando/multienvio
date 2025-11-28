"use client";

import {
  CarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { Card, Space, Spin, Typography } from "antd";

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
  const hasPickupFee = pickupFee && pickupFee.feeAmount > 0;
  const total = hasPickupFee ? preco + pickupFee.feeAmount : preco;

  return (
    <Card
      size="small"
      title="Resumo do serviço"
      style={{
        background: "#f6ffed",
        borderColor: "#b7eb8f",
      }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {/* Transportadora e Modalidade */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Space size={6}>
            <TruckOutlined style={{ fontSize: 14, color: "#52c41a" }} />
            <Typography.Text style={{ fontSize: 13 }}>
              <strong>{carrier}</strong>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {" "}• {modalidade}
              </Typography.Text>
            </Typography.Text>
          </Space>

          <Space size={6}>
            <ClockCircleOutlined style={{ fontSize: 14, color: "#1890ff" }} />
            <Typography.Text style={{ fontSize: 13 }}>
              <strong>Prazo:</strong>{" "}
              {prazoDias === 1 ? "1 dia útil" : `${prazoDias} dias úteis`}
            </Typography.Text>
          </Space>
        </div>

        {/* Preço e Total */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <Space size={6}>
            <DollarOutlined style={{ fontSize: 14, color: "#52c41a" }} />
            <Typography.Text style={{ fontSize: 13 }}>
              <strong>Frete:</strong> {currency.format(preco)}
            </Typography.Text>
          </Space>

          {isLoadingPickupFee && (
            <Space size={6}>
              <Spin size="small" />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Calculando coleta...
              </Typography.Text>
            </Space>
          )}

          {!isLoadingPickupFee && hasPickupFee && (
            <>
              <Space size={6}>
                <CarOutlined style={{ fontSize: 14, color: "#fa8c16" }} />
                <Typography.Text style={{ fontSize: 13 }}>
                  <strong>Coleta:</strong> {currency.format(pickupFee.feeAmount)}
                </Typography.Text>
              </Space>

              <Typography.Text strong style={{ fontSize: 14, color: "#1890ff" }}>
                Total: {currency.format(total)}
              </Typography.Text>
            </>
          )}
        </div>
      </Space>
    </Card>
  );
}
