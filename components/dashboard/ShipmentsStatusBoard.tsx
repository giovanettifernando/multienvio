'use client';

import { Card, Flex, Space, Typography, Badge, Progress, Skeleton } from 'antd';
import {
  ClockCircleOutlined,
  CarOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Shipment } from '@/types/shipment';

const { Text } = Typography;

interface ShipmentsStatusBoardProps {
  shipments: Shipment[];
  loading?: boolean;
}

interface StatusColumn {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  statuses: Shipment['status'][];
}

const COLUMNS: StatusColumn[] = [
  {
    key: 'awaiting',
    label: 'Aguardando',
    icon: <ClockCircleOutlined />,
    color: 'orange',
    statuses: ['aguardando_coleta', 'pendente'],
  },
  {
    key: 'transit',
    label: 'Em trânsito',
    icon: <CarOutlined />,
    color: 'blue',
    statuses: ['em_transito', 'postado'],
  },
  {
    key: 'delivery',
    label: 'Em rota',
    icon: <RocketOutlined />,
    color: 'purple',
    statuses: ['em_rota_de_entrega'],
  },
  {
    key: 'delivered',
    label: 'Entregue',
    icon: <CheckCircleOutlined />,
    color: 'green',
    statuses: ['entregue'],
  },
  {
    key: 'exceptions',
    label: 'Exceções',
    icon: <WarningOutlined />,
    color: 'red',
    statuses: [], // No exception statuses defined yet
  },
];

export function ShipmentsStatusBoard({ shipments, loading }: ShipmentsStatusBoardProps) {
  const router = useRouter();

  if (loading) {
    return (
      <Card title="Status de Envios" variant="outlined">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  const total = shipments.length;

  const columnCounts = COLUMNS.map(column => ({
    ...column,
    count: shipments.filter(s => column.statuses.includes(s.status)).length,
    percentage: total > 0 ? (shipments.filter(s => column.statuses.includes(s.status)).length / total) * 100 : 0,
  }));

  const handleClick = (column: typeof COLUMNS[0]) => {
    const statusParam = column.statuses.join(',');
    router.push(`/envios?status=${statusParam}`);
  };

  return (
    <Card title="Status de Envios" variant="outlined">
      <Flex gap={12} wrap="wrap">
        {columnCounts.map(column => (
          <Card
            key={column.key}
            size="small"
            variant="outlined"
            hoverable
            onClick={() => handleClick(column)}
            style={{
              flex: '1 1 140px',
              minWidth: 140,
              cursor: 'pointer',
              borderColor: column.count > 0 ? `var(--ant-color-${column.color})` : undefined,
            }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {column.icon} {column.label}
                </Text>
                <Badge
                  count={column.count}
                  style={{
                    backgroundColor: `var(--ant-color-${column.color})`,
                  }}
                />
              </Flex>

              <Text strong style={{ fontSize: '24px', lineHeight: 1 }}>
                {column.count}
              </Text>

              <Progress
                percent={column.percentage}
                size="small"
                showInfo={false}
                strokeColor={`var(--ant-color-${column.color})`}
              />
            </Space>
          </Card>
        ))}
      </Flex>

      {total === 0 && (
        <Flex justify="center" style={{ padding: '24px 0' }}>
          <Text type="secondary">Nenhum envio encontrado</Text>
        </Flex>
      )}
    </Card>
  );
}
