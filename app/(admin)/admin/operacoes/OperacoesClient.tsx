'use client';

import { useState, useMemo } from 'react';
import { Card, Statistic, Row, Col, Select, DatePicker, Flex, Tabs, Skeleton, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getOpsKpis } from '@/lib/admin/ops/api';
import ShipmentsTable from '@/components/admin/ops/ShipmentsTable';
import PickupsTable from '@/components/admin/ops/PickupsTable';
import ReceptionsTable from '@/components/admin/ops/ReceptionsTable';
import ExceptionsTable from '@/components/admin/ops/ExceptionsTable';
import EventsTable from '@/components/admin/ops/EventsTable';
import { PageShell } from '@/components/shared/PageShell';

const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export default function OperacoesClient() {
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

  // Fetch KPIs from aggregated endpoint
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'ops', 'kpis'],
    queryFn: getOpsKpis,
  });

  const tabItems = [
    {
      key: 'shipments',
      label: 'Envios',
      children: <ShipmentsTable dateStart={_period.dateStart} dateEnd={_period.dateEnd} />,
    },
    {
      key: 'pickups',
      label: 'Coletas',
      children: <PickupsTable dateStart={_period.dateStart} dateEnd={_period.dateEnd} />,
    },
    {
      key: 'pocs',
      label: 'Pontos de Coleta',
      children: <ReceptionsTable dateStart={_period.dateStart} dateEnd={_period.dateEnd} />,
    },
    {
      key: 'exceptions',
      label: 'Exceções',
      children: <ExceptionsTable dateStart={_period.dateStart} dateEnd={_period.dateEnd} />,
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
    <PageShell
      title="Operações"
      gap="md"
      extra={
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
      }
    >
      {/* KPIs */}
      {kpisLoading ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : (
        <Card title="Visão Geral da Operação" size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Em Backlog"
                value={kpis?.backlog ?? 0}
                styles={{ content: { color: (kpis?.backlog ?? 0) > 10 ? '#cf1322' : '#000' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Em Coleta"
                value={kpis?.inPickup ?? 0}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="No PoC"
                value={kpis?.atPoC ?? 0}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Em Trânsito"
                value={kpis?.inTransit ?? 0}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Em Entrega"
                value={kpis?.outForDelivery ?? 0}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Exceções"
                value={kpis?.exceptions ?? 0}
                styles={{ content: { color: (kpis?.exceptions ?? 0) > 0 ? '#cf1322' : '#52c41a' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Entregues"
                value={kpis?.delivered ?? 0}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={12} sm={8} lg={4} xl={3}>
              <Statistic
                title="Cancelados"
                value={kpis?.cancelled ?? 0}
                styles={{ content: { color: '#8c8c8c' } }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabs */}
      <Card size="small" style={{ minHeight: 400 }}>
        <Tabs items={tabItems} />
      </Card>
    </PageShell>
  );
}
