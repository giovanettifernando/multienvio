"use client";

import React from "react";
import { Button, Card, Space, Typography, Row, Col } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useWallet } from "@/hooks/useWallet";
import { formatNumberBR } from "@/lib/format";

export default function BalanceCard({ onAddFunds }: { onAddFunds: () => void }) {
  const { data, isLoading } = useWallet();

  const available = data?.balance?.availableReais ?? 0;
  const pending = data?.balance?.pendingReais ?? 0;

  return (
    <Card loading={isLoading}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            {/* Saldo disponível - destaque forte */}
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              Saldo disponível
            </Typography.Text>
            <Typography.Title
              level={1}
              style={{
                margin: 0,
                fontSize: 42,
                fontWeight: 700,
                color: "#1890ff",
                lineHeight: 1.2
              }}
            >
              R$ {formatNumberBR(available)}
            </Typography.Title>

            {/* Saldo pendente (se houver) */}
            {pending > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                + R$ {formatNumberBR(pending)} pendente
              </Typography.Text>
            )}
          </Space>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Botão de adicionar saldo */}
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={onAddFunds}
            block
            loading={isLoading}
            style={{ height: 48 }}
          >
            Adicionar saldo
          </Button>
        </Col>
      </Row>
    </Card>
  );
}
