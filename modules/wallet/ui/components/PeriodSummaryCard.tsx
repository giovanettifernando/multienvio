"use client";

import { ELCard, ELTypography } from '@/shared/ui';
const Card = ELCard;
const Typography = ELTypography;
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import type { PeriodSummary } from '@/shared/types/wallet-statement';
import { formatCurrencyBRL } from "@/shared/utils/format";

const { Text } = Typography;

interface PeriodSummaryCardProps {
  summary: PeriodSummary;
  loading?: boolean;
}

export default function PeriodSummaryCard({ summary, loading }: PeriodSummaryCardProps) {
  const startDate = new Date(summary.periodStart).toLocaleDateString('pt-BR');
  const endDate = new Date(summary.periodEnd).toLocaleDateString('pt-BR');

  return (
    <Card
      title={
        <div>
          <Text strong>Resumo do Período</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
            {startDate} - {endDate}
          </Text>
        </div>
      }
      loading={loading}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Créditos */}
        <div style={{ flex: 1 }}>
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Créditos</Text>
          </div>
          <Text strong style={{ fontSize: 16, color: '#52c41a', whiteSpace: 'nowrap' }}>
            {formatCurrencyBRL(summary.totalCredits)} <ArrowUpOutlined style={{ fontSize: 12 }} />
          </Text>
        </div>
        {/* Débitos */}
        <div style={{ flex: 1 }}>
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Débitos</Text>
          </div>
          <Text strong style={{ fontSize: 16, color: '#ff4d4f', whiteSpace: 'nowrap' }}>
            {formatCurrencyBRL(summary.totalDebits)} <ArrowDownOutlined style={{ fontSize: 12 }} />
          </Text>
        </div>
        {/* Saldo do Período */}
        <div style={{ flex: 1 }}>
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Saldo do Período</Text>
          </div>
          <Text strong style={{ fontSize: 16, color: summary.netAmount >= 0 ? '#52c41a' : '#ff4d4f', whiteSpace: 'nowrap' }}>
            {formatCurrencyBRL(summary.netAmount)}
          </Text>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {summary.transactionCount} transaç{summary.transactionCount === 1 ? 'ão' : 'ões'} no período
        </Text>
      </div>
    </Card>
  );
}
