'use client';

import { useState, useMemo } from 'react';
import { Card, Statistic, Row, Col, Select, DatePicker, Flex, Tabs, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { PeriodFilter } from '@/lib/admin/finance/types';
import { getFinanceSummary } from '@/lib/admin/finance/api';
import { LedgerTable } from '@/components/admin/finance/LedgerTable';
import { InvoicesTable } from '@/components/admin/finance/InvoicesTable';
import { ReconciliationTable } from '@/components/admin/finance/ReconciliationTable';
import { ChargebacksTable } from '@/components/admin/finance/ChargebacksTable';
import { PayoutsTable } from '@/components/admin/finance/PayoutsTable';
import { CommissionsTable } from '@/components/admin/finance/CommissionsTable';
import { FeesView } from '@/components/admin/finance/FeesView';
import { Reports } from '@/components/admin/finance/Reports';

const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export default function AdminFinanceiroPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const period = useMemo<PeriodFilter>(() => {
    const now = dayjs();
    switch (periodPreset) {
      case 'today':
        return {
          dateStart: now.startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '7d':
        return {
          dateStart: now.subtract(7, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '30d':
        return {
          dateStart: now.subtract(30, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'month':
        return {
          dateStart: now.startOf('month').toISOString(),
          dateEnd: now.endOf('month').toISOString(),
        };
      case 'custom':
        if (customRange) {
          return {
            dateStart: customRange[0].startOf('day').toISOString(),
            dateEnd: customRange[1].endOf('day').toISOString(),
          };
        }
        return {};
      default:
        return {};
    }
  }, [periodPreset, customRange]);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin', 'finance', 'summary', period],
    queryFn: () => getFinanceSummary(period),
  });

  const tabItems = [
    {
      key: 'ledger',
      label: 'Movimentações',
      children: <LedgerTable period={period} />,
    },
    {
      key: 'invoices',
      label: 'Faturação',
      children: <InvoicesTable period={period} />,
    },
    {
      key: 'reconciliation',
      label: 'Conciliação',
      children: <ReconciliationTable period={period} />,
    },
    {
      key: 'chargebacks',
      label: 'Estornos/Chargebacks',
      children: <ChargebacksTable period={period} />,
    },
    {
      key: 'payouts',
      label: 'Repasses',
      children: <PayoutsTable period={period} />,
    },
    {
      key: 'commissions',
      label: 'Comissões',
      children: <CommissionsTable period={period} />,
    },
    {
      key: 'fees',
      label: 'Taxas/Fees',
      children: <FeesView />,
    },
    {
      key: 'reports',
      label: 'Relatórios Fiscais',
      children: <Reports period={period} />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Flex vertical gap={24}>
        {/* Header */}
        <Flex justify="space-between" align="center">
          <h1 style={{ margin: 0 }}>Financeiro</h1>
          <Flex gap={12} align="center">
            <Select
              value={periodPreset}
              onChange={(v) => {
                setPeriodPreset(v);
                if (v !== 'custom') {
                  setCustomRange(null);
                }
              }}
              style={{ width: 150 }}
              options={[
                { label: 'Hoje', value: 'today' },
                { label: 'Últimos 7 dias', value: '7d' },
                { label: 'Últimos 30 dias', value: '30d' },
                { label: 'Mês atual', value: 'month' },
                { label: 'Personalizado', value: 'custom' },
              ]}
            />
            {periodPreset === 'custom' && (
              <RangePicker
                value={customRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setCustomRange([dates[0], dates[1]]);
                  }
                }}
                format="DD/MM/YYYY"
              />
            )}
          </Flex>
        </Flex>

        {/* KPIs */}
        {summaryLoading ? (
          <Card>
            <Skeleton active />
          </Card>
        ) : (
          <Card title="Resumo do Período" size="small">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Receita Bruta"
                  value={summary?.grossRevenue || 0}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Taxas Plataforma"
                  value={summary?.platformFees || 0}
                  precision={2}
                  prefix="R$"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Repasses Transportadoras"
                  value={summary?.carrierPayouts || 0}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Comissões"
                  value={summary?.partnerCommissions || 0}
                  precision={2}
                  prefix="R$"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Estornos"
                  value={summary?.refunds || 0}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Chargebacks"
                  value={summary?.chargebacks || 0}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Saldo em Carteira (Clientes)"
                  value={summary?.customersWalletBalance || 0}
                  precision={2}
                  prefix="R$"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Resultado Operacional"
                  value={summary?.platformOperationalBalance || 0}
                  precision={2}
                  prefix="R$"
                  valueStyle={{
                    color: (summary?.platformOperationalBalance || 0) >= 0 ? '#3f8600' : '#cf1322',
                    fontWeight: 'bold',
                  }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Tabs */}
        <Card size="small" style={{ minHeight: 600 }}>
          <Tabs items={tabItems} />
        </Card>
      </Flex>
    </div>
  );
}
