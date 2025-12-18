"use client";

import React from "react";
import { Card, Space, Typography, Row, Col, Button } from "antd";
import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { useWallet } from "@/hooks/useWallet";
import { formatNumberBR } from "@/shared/utils/format";
import { ELButton } from '@/shared/ui/ELButton';

interface BalanceCardProps {
  onAddFunds: () => void;
  onResolveDebt?: () => void;
}

export default function BalanceCard({ onAddFunds, onResolveDebt }: BalanceCardProps) {
  const { data, isLoading } = useWallet();

  const available = data?.balance?.availableReais ?? 0;
  const pending = data?.balance?.pendingReais ?? 0;
  const hasNegativeBalance = available < 0;
  const negativeAmount = Math.abs(available);

  return (
    <Card loading={isLoading}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={16}>
          <Space orientation="vertical" size="small" style={{ width: "100%" }}>
            {/* Saldo disponível - destaque forte */}
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              Saldo disponível
            </Typography.Text>
            <Typography.Title
              level={1}
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 700,
                color: hasNegativeBalance ? "#ff4d4f" : "#1890ff",
                lineHeight: 1.2
              }}
            >
              {hasNegativeBalance ? "-" : ""} R$ {formatNumberBR(Math.abs(available))}
            </Typography.Title>

            {/* Saldo pendente (se houver) */}
            {pending > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                + R$ {formatNumberBR(pending)} pendente
              </Typography.Text>
            )}
          </Space>
        </Col>

        <Col xs={24} md={12} lg={8} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Botão de adicionar saldo */}
          <ELButton
            variant="primary"
            icon={<PlusOutlined />}
            onClick={onAddFunds}
            block
            loading={isLoading}
          >
            Adicionar saldo
          </ELButton>
        </Col>
      </Row>

      {/* Banner de saldo negativo */}
      {hasNegativeBalance && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            backgroundColor: "#ff4d4f",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Space>
            <WarningOutlined style={{ color: "white", fontSize: 18 }} />
            <Typography.Text style={{ color: "white", fontWeight: 500 }}>
              Resolver pendências financeiras (R$ {formatNumberBR(negativeAmount)})
            </Typography.Text>
          </Space>
          <Button
            type="default"
            size="small"
            onClick={onResolveDebt}
            style={{
              backgroundColor: "white",
              borderColor: "white",
              color: "#ff4d4f",
              fontWeight: 500,
            }}
          >
            Resolver agora
          </Button>
        </div>
      )}
    </Card>
  );
}
