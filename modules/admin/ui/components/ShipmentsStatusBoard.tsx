'use client';

import { useState, useMemo } from 'react';
import { Flex, Typography, Skeleton } from 'antd';
import { ELCard, ELSelect } from '@/shared/ui';
const Card = ELCard;
const Select = ELSelect;
import {
  InboxOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Text } = Typography;

type TimeFilter = 'year' | 'month' | 'week' | 'today';

interface ShipmentsStatusBoardProps {
  shipments: Array<{ status: string; createdAt?: string }>;
  loading?: boolean;
}

interface StatusConfig {
  key: string;
  label: string;
  statuses: string[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  filterParam?: string;
  timeFiltered?: boolean;
}

const UI_STATUSES = {
  AGUARDANDO_COLETA: 'Aguardando coleta',
  AGUARDANDO_POSTAGEM: 'Aguardando postagem',
  POSTADO: 'Postado',
  EM_TRANSITO: 'Em trânsito',
  EM_ROTA_ENTREGA: 'Em rota de entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
  DEVOLVIDO: 'Devolvido',
};

const STATUS_CONFIG: StatusConfig[] = [
  {
    key: 'queue',
    label: 'Na fila',
    statuses: [
      UI_STATUSES.AGUARDANDO_COLETA,
      UI_STATUSES.AGUARDANDO_POSTAGEM,
      UI_STATUSES.POSTADO,
      UI_STATUSES.EM_TRANSITO,
      UI_STATUSES.EM_ROTA_ENTREGA,
    ],
    icon: <InboxOutlined />,
    color: '#003873',
    bgColor: '#e6f4ff',
  },
  {
    key: 'awaiting_pickup',
    label: 'Aguardando coleta',
    statuses: [UI_STATUSES.AGUARDANDO_COLETA],
    icon: <ClockCircleOutlined />,
    color: '#faad14',
    bgColor: '#fffbe6',
    filterParam: 'Aguardando coleta',
  },
  {
    key: 'awaiting_posting',
    label: 'Aguardando postagem',
    statuses: [UI_STATUSES.AGUARDANDO_POSTAGEM],
    icon: <PrinterOutlined />,
    color: '#1890ff',
    bgColor: '#e6f7ff',
    filterParam: 'Aguardando postagem',
  },
  {
    key: 'in_transit',
    label: 'Em trânsito',
    statuses: [UI_STATUSES.POSTADO, UI_STATUSES.EM_TRANSITO, UI_STATUSES.EM_ROTA_ENTREGA],
    icon: <CarOutlined />,
    color: '#722ed1',
    bgColor: '#f9f0ff',
    filterParam: 'Em trânsito',
  },
  {
    key: 'delivered',
    label: 'Entregues',
    statuses: [UI_STATUSES.ENTREGUE],
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    bgColor: '#f6ffed',
    filterParam: 'Entregue',
    timeFiltered: true,
  },
  {
    key: 'canceled',
    label: 'Cancelados',
    statuses: [UI_STATUSES.CANCELADO, UI_STATUSES.DEVOLVIDO],
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: '#fff2f0',
    filterParam: 'Cancelado',
    timeFiltered: true,
  },
];

const TIME_FILTER_OPTIONS = [
  { value: 'year', label: 'No ano' },
  { value: 'month', label: 'No mês' },
  { value: 'week', label: 'Na semana' },
  { value: 'today', label: 'Hoje' },
];

function getDateThreshold(filter: TimeFilter): Date {
  const now = new Date();
  switch (filter) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
  }
}

export function ShipmentsStatusBoard({ shipments, loading }: ShipmentsStatusBoardProps) {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  const filteredShipments = useMemo(() => {
    const threshold = getDateThreshold(timeFilter);
    return shipments.filter(s => {
      if (!s.createdAt) return true;
      return new Date(s.createdAt) >= threshold;
    });
  }, [shipments, timeFilter]);

  const statusCounts = useMemo(() => {
    return STATUS_CONFIG.map(config => ({
      ...config,
      count: (config.timeFiltered ? filteredShipments : shipments).filter(s =>
        config.statuses.includes(s.status)
      ).length,
    }));
  }, [shipments, filteredShipments]);

  const handleClick = (config: StatusConfig) => {
    if (config.filterParam) {
      router.push(`/shipments?status=${encodeURIComponent(config.filterParam)}`);
    } else {
      router.push('/shipments');
    }
  };

  if (loading) {
    return (
      <Card
        title={
          <Flex align="center" gap={8}>
            <InboxOutlined />
            <Text strong>Status dos Envios</Text>
          </Flex>
        }
        variant="outlined"
        size="small"
      >
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex align="center" gap={8}>
            <InboxOutlined />
            <Text strong>Status dos Envios</Text>
          </Flex>
          <Select
            size="small"
            value={timeFilter}
            onChange={setTimeFilter}
            options={TIME_FILTER_OPTIONS}
            style={{ width: 110 }}
          />
        </Flex>
      }
      variant="outlined"
      size="small"
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        {statusCounts.map(item => (
          <Flex
            key={item.key}
            vertical
            align="center"
            justify="center"
            gap={6}
            onClick={() => handleClick(item)}
            style={{
              padding: '16px 8px',
              borderRadius: 8,
              background: item.bgColor,
              border: `1px solid ${item.color}22`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${item.color}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ color: item.color, fontSize: 22 }}>{item.icon}</span>
            <Text strong style={{ fontSize: 28, color: item.color, lineHeight: 1 }}>
              {item.count}
            </Text>
            <Text style={{ fontSize: 12, color: item.color, opacity: 0.8, textAlign: 'center' }}>
              {item.label}
            </Text>
          </Flex>
        ))}
      </div>
    </Card>
  );
}
