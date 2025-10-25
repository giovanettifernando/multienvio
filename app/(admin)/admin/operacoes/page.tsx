'use client';

import { useState, useMemo } from 'react';
import { Card, Statistic, Row, Col, Select, DatePicker, Flex, Tabs, Skeleton, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { listShipments } from '@/lib/admin/ops/api';
import ShipmentsTable from '@/components/admin/ops/ShipmentsTable';
import PoCTable from '@/components/admin/ops/PoCTable';
import EventsTable from '@/components/admin/ops/EventsTable';

const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export default function AdminOperacoesPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Period calculation (ready for future use with date filtering)
  const _period = useMemo(() => {
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

  // Fetch all shipments to calculate KPIs
  const { data: allShipments, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'ops', 'shipments', 'all'],
    queryFn: () => listShipments({ page: 1, pageSize: 100 }),
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!allShipments?.items) {
      return {
        backlog: 0,
        inPickup: 0,
        atPoC: 0,
        inTransit: 0,
        exceptions: 0,
        delivered: 0,
        slaRisk: 0,
      };
    }

    const items = allShipments.items;
    return {
      backlog: items.filter((s) => s.status === 'awaiting_dropoff' || s.status === 'awaiting_pickup').length,
      inPickup: items.filter((s) => s.status === 'in_pickup').length,
      atPoC: items.filter((s) => s.status === 'received_at_poc').length,
      inTransit: items.filter((s) => s.status === 'in_transit' || s.status === 'out_for_delivery').length,
      exceptions: items.filter((s) => s.status === 'exception').length,
      delivered: items.filter((s) => s.status === 'delivered').length,
      slaRisk: items.filter((s) => s.riskFlag).length,
    };
  }, [allShipments]);

  const tabItems = [
    {
      key: 'shipments',
      label: 'Pedidos/Envios',
      children: <ShipmentsTable dateStart={_period.dateStart} dateEnd={_period.dateEnd} />,
    },
    {
      key: 'pickups',
      label: 'Coletas',
      children: (
        <Alert
          message="Funcionalidade em Desenvolvimento"
          description="Gestão de coletas (home pickup e PoC pickup) estará disponível em breve."
          type="info"
          showIcon
        />
      ),
    },
    {
      key: 'pocs',
      label: 'Pontos de Coleta',
      children: <PoCTable />,
    },
    {
      key: 'exceptions',
      label: 'Exceções',
      children: (
        <Alert
          message="Funcionalidade em Desenvolvimento"
          description="Gestão de exceções operacionais estará disponível em breve."
          type="info"
          showIcon
        />
      ),
    },
    {
      key: 'sla',
      label: 'SLA & Capacidade',
      children: (
        <Alert
          message="Funcionalidade em Desenvolvimento"
          description="Monitoramento de SLAs e capacidade operacional estará disponível em breve."
          type="info"
          showIcon
        />
      ),
    },
    {
      key: 'events',
      label: 'Eventos/Webhooks',
      children: <EventsTable />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Flex vertical gap={24}>
        {/* Header */}
        <Flex justify="space-between" align="center">
          <h1 style={{ margin: 0 }}>Operações</h1>
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
        {kpisLoading ? (
          <Card>
            <Skeleton active />
          </Card>
        ) : (
          <Card title="Visão Geral da Operação" size="small">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="Em Backlog"
                  value={kpis.backlog}
                  valueStyle={{ color: kpis.backlog > 10 ? '#cf1322' : '#000' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="Em Coleta"
                  value={kpis.inPickup}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="No PoC"
                  value={kpis.atPoC}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="Em Trânsito"
                  value={kpis.inTransit}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="Exceções"
                  value={kpis.exceptions}
                  valueStyle={{ color: kpis.exceptions > 0 ? '#cf1322' : '#52c41a' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="Entregues"
                  value={kpis.delivered}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6} xl={3}>
                <Statistic
                  title="SLAs em Risco"
                  value={kpis.slaRisk}
                  valueStyle={{ color: kpis.slaRisk > 0 ? '#cf1322' : '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Tabs */}
        <Card size="small" style={{ minHeight: 400 }}>
          <Tabs items={tabItems} />
        </Card>
      </Flex>
    </div>
  );
}
