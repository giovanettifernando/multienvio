'use client';

import { useState, useMemo } from 'react';
import { Card, Flex, Typography, Skeleton, Select } from 'antd';
import {
  InboxOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  SendOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  EnvironmentOutlined,
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
}

// Status da UI retornados pela API
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
    filterParam: 'Todos', // Mostrar todos e filtrar no frontend
  },
  {
    key: 'awaiting_pickup',
    label: 'Aguard. coleta',
    statuses: [UI_STATUSES.AGUARDANDO_COLETA],
    icon: <ClockCircleOutlined />,
    color: '#faad14',
    bgColor: '#fffbe6',
    filterParam: 'Aguardando coleta',
  },
  {
    key: 'awaiting_posting',
    label: 'Aguard. postagem',
    statuses: [UI_STATUSES.AGUARDANDO_POSTAGEM],
    icon: <PrinterOutlined />,
    color: '#1890ff',
    bgColor: '#e6f7ff',
    filterParam: 'Aguardando postagem',
  },
  {
    key: 'posted',
    label: 'Postados',
    statuses: [UI_STATUSES.POSTADO],
    icon: <SendOutlined />,
    color: '#13c2c2',
    bgColor: '#e6fffb',
    filterParam: 'Postado',
  },
  {
    key: 'in_transit',
    label: 'Em trânsito',
    statuses: [UI_STATUSES.EM_TRANSITO, UI_STATUSES.EM_ROTA_ENTREGA],
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
  },
  {
    key: 'canceled',
    label: 'Cancelados',
    statuses: [UI_STATUSES.CANCELADO, UI_STATUSES.DEVOLVIDO],
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: '#fff2f0',
    filterParam: 'Cancelado',
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
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
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
      count: filteredShipments.filter(s =>
        config.statuses.includes(s.status)
      ).length,
    }));
  }, [filteredShipments]);

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
            <CarOutlined />
            <Text strong>Status dos Envios</Text>
          </Flex>
        }
        variant="outlined"
        size="small"
      >
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex align="center" gap={8}>
            <CarOutlined />
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
      <Flex gap={8} wrap="wrap">
        {statusCounts.map(item => (
          <Flex
            key={item.key}
            align="center"
            gap={8}
            onClick={() => handleClick(item)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: item.bgColor,
              border: `1px solid ${item.color}20`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: 1,
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ color: item.color, fontSize: 16 }}>{item.icon}</span>
            <Flex vertical gap={0}>
              <Text style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                {item.label}
              </Text>
              <Text strong style={{ fontSize: 18, color: item.color, lineHeight: 1 }}>
                {item.count}
              </Text>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}
