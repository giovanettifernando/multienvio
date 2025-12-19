"use client";

import React from "react";
import { ELCard, ELRow, ELCol, ELStatistic, ELTypography } from '@/shared/ui';
const Card = ELCard;
const Row = ELRow;
const Col = ELCol;
const Statistic = ELStatistic;
const Typography = ELTypography;
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import type { PeriodSummary } from '@/shared/types/wallet-statement';
import { formatCurrencyBRL } from "@/shared/utils/format";

const { Text } = Typography;

interface MonthlySummaryCardProps {
  summary: PeriodSummary;
  loading?: boolean;
}

export default function MonthlySummaryCard({ summary, loading }: MonthlySummaryCardProps) {
  const currentMonth = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <Card
      title={
        <div>
          <Text strong>Resumo do Mês</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
            {currentMonth}
          </Text>
        </div>
      }
      loading={loading}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Statistic
            title="Créditos"
            value={formatCurrencyBRL(summary.totalCredits)}
            suffix={<ArrowUpOutlined style={{ fontSize: 14, color: '#52c41a' }} />}
            styles={{ content: { color: '#52c41a', fontSize: 18 } }}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Débitos"
            value={formatCurrencyBRL(summary.totalDebits)}
            suffix={<ArrowDownOutlined style={{ fontSize: 14, color: '#ff4d4f' }} />}
            styles={{ content: { color: '#ff4d4f', fontSize: 18 } }}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="Saldo do Período"
            value={formatCurrencyBRL(summary.netAmount)}
            styles={{ content: {
              color: summary.netAmount >= 0 ? '#52c41a' : '#ff4d4f',
              fontSize: 18,
              fontWeight: 600
            } }}
          />
        </Col>
      </Row>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {summary.transactionCount} transaç{summary.transactionCount === 1 ? 'ão' : 'ões'} no período
        </Text>
      </div>
    </Card>
  );
}
