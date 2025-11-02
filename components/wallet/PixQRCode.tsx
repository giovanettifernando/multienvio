"use client";

import { useState } from "react";
import { Button, Card, message, Space, Typography } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import type { PixTopup } from "@/types/billing";

type PixQRCodeProps = {
  topup: PixTopup;
  onConfirm?: () => void;
};

export function PixQRCode({ topup, onConfirm }: PixQRCodeProps) {
  const [confirming, setConfirming] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      const response = await fetch("/api/wallet/topups/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: topup.referenceId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.message ?? "Erro ao confirmar pagamento");
      }

      messageApi.success("Pagamento confirmado com sucesso!");
      onConfirm?.();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "Erro ao confirmar pagamento");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Card variant="borderless">
        <Space direction="vertical" size={16} align="center" style={{ width: "100%" }}>
          <Typography.Text type="secondary">Escaneie o QR Code abaixo para pagar:</Typography.Text>

          {/* QR Code Mock */}
          <div
            style={{
              width: 240,
              height: 240,
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              border: "2px dashed #d9d9d9",
            }}
          >
            <Typography.Text type="secondary">QR CODE PIX</Typography.Text>
          </div>

          <Typography.Paragraph style={{ margin: 0, textAlign: "center" }}>
            <Typography.Text strong style={{ fontSize: 18 }}>
              {topup.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Reference: {topup.referenceId}
            </Typography.Text>
          </Typography.Paragraph>

          {topup.status === "PENDING" && (
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirmPayment}
              loading={confirming}
              block
            >
              Já paguei
            </Button>
          )}

          {topup.status === "CONFIRMED" && (
            <Typography.Text type="success">
              <CheckCircleOutlined /> Pagamento confirmado!
            </Typography.Text>
          )}
        </Space>
      </Card>
    </>
  );
}
