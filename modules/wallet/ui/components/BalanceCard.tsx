"use client";

import { ELSpace, ELTypography } from '@/shared/ui';
const Space = ELSpace;
const Typography = ELTypography;
import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { useWallet } from "@/modules/wallet/ui/hooks";
import { formatNumberBR } from "@/shared/utils/format";
import { ELButton, ELCard } from '@/shared/ui';

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
    <ELCard loading={isLoading}>
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
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
            lineHeight: 1.2,
          }}
        >
          {hasNegativeBalance ? "-" : ""} R$ {formatNumberBR(Math.abs(available))}
        </Typography.Title>

        {pending > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            + R$ {formatNumberBR(pending)} pendente
          </Typography.Text>
        )}

        <ELButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={onAddFunds}
          block
          loading={isLoading}
        >
          Adicionar saldo
        </ELButton>
      </Space>

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
          <ELButton
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
          </ELButton>
        </div>
      )}
    </ELCard>
  );
}
