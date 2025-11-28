'use client';

import { Card, Flex, Typography, Tag, Skeleton } from 'antd';
import {
  FileTextOutlined,
  PrinterOutlined,
  SendOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import {
  ShipmentStatus,
  SHIPMENT_STATUS_LABELS,
} from '@/types/contracts';

const { Text } = Typography;

interface ShipmentsStatusBoardProps {
  shipments: Array<{ status: string }>;
  loading?: boolean;
}

interface StatusConfig {
  status: ShipmentStatus;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: StatusConfig[] = [
  {
    status: ShipmentStatus.CRIADO,
    icon: <FileTextOutlined />,
    color: '#595959',
    bgColor: '#fafafa',
  },
  {
    status: ShipmentStatus.ETIQUETA_EMITIDA,
    icon: <PrinterOutlined />,
    color: '#1890ff',
    bgColor: '#e6f7ff',
  },
  {
    status: ShipmentStatus.POSTADO,
    icon: <SendOutlined />,
    color: '#13c2c2',
    bgColor: '#e6fffb',
  },
  {
    status: ShipmentStatus.EM_TRANSPORTE,
    icon: <CarOutlined />,
    color: '#722ed1',
    bgColor: '#f9f0ff',
  },
  {
    status: ShipmentStatus.ENTREGUE,
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    bgColor: '#f6ffed',
  },
  {
    status: ShipmentStatus.CANCELADO,
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: '#fff2f0',
  },
];

export function ShipmentsStatusBoard({ shipments, loading }: ShipmentsStatusBoardProps) {
  const router = useRouter();

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

  const statusCounts = STATUS_CONFIG.map(config => ({
    ...config,
    count: shipments.filter(s => s.status === config.status).length,
  }));

  const total = shipments.length;

  const handleClick = (status: ShipmentStatus) => {
    router.push(`/shipments?status=${status}`);
  };

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <CarOutlined />
          <Text strong>Status dos Envios</Text>
          {total > 0 && (
            <Tag style={{ marginLeft: 8 }}>{total} total</Tag>
          )}
        </Flex>
      }
      variant="outlined"
      size="small"
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Flex gap={8} wrap="wrap">
        {statusCounts.map(item => (
          <Flex
            key={item.status}
            align="center"
            gap={8}
            onClick={() => handleClick(item.status)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: item.bgColor,
              border: `1px solid ${item.color}20`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 120,
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
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                {SHIPMENT_STATUS_LABELS[item.status]}
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
