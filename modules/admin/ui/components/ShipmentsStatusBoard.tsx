'use client';

import { useMemo } from 'react';
import { Flex, Typography, Skeleton } from 'antd';
import { ELCard } from '@/shared/ui';
const Card = ELCard;
import {
  InboxOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Text } = Typography;

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
};

// Apenas status ativos (filas) - sem filtro de tempo
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
    key: 'in_transit',
    label: 'Em trânsito',
    statuses: [UI_STATUSES.POSTADO, UI_STATUSES.EM_TRANSITO, UI_STATUSES.EM_ROTA_ENTREGA],
    icon: <CarOutlined />,
    color: '#722ed1',
    bgColor: '#f9f0ff',
    filterParam: 'Em trânsito',
  },
];

export function ShipmentsStatusBoard({ shipments, loading }: ShipmentsStatusBoardProps) {
  const router = useRouter();

  // Conta todos os shipments ativos sem filtro de tempo
  const statusCounts = useMemo(() => {
    return STATUS_CONFIG.map(config => ({
      ...config,
      count: shipments.filter(s =>
        config.statuses.includes(s.status)
      ).length,
    }));
  }, [shipments]);

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
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

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
              background: '#fff',
              border: `1px solid #e8e8e8`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: '1 1 auto',
              minWidth: 90,
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
