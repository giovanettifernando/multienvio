"use client";

import { Card, Space, Typography } from "antd";
import type { PixTopup } from "@/types/billing";

type PixQRCodeProps = {
  topup: PixTopup;
};

export function PixQRCode({ topup }: PixQRCodeProps) {
  return (
    <Card title="PIX" variant="borderless">
      <Space direction="vertical" size={12} align="center" style={{ width: "100%" }}>
        <Typography.Text type="secondary">Escaneie o QR Code abaixo:</Typography.Text>
        <div
          style={{
            width: 200,
            height: 200,
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
          }}
        >
          <Typography.Text>QR MOCK</Typography.Text>
        </div>
        <Typography.Paragraph style={{ margin: 0, textAlign: "center" }}>
          Valor: {topup.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          <br />
          Expira em: {new Date(topup.expiresAt).toLocaleTimeString("pt-BR")}
        </Typography.Paragraph>
        <Typography.Text type={topup.status === "PENDING" ? "warning" : "success"}>
          {topup.status === "PENDING" ? "Aguardando pagamento" : "Pagamento confirmado"}
        </Typography.Text>
      </Space>
    </Card>
  );
}
