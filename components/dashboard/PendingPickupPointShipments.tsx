'use client';

import { Card, List, Typography, Tag, Skeleton, Empty, Button, Flex, Badge } from 'antd';
import { EnvironmentOutlined, RightOutlined, InboxOutlined, PrinterOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

interface PendingShipment {
  id: string;
  trackingCode: string;
  pickupPointName: string;
  pickupPointCity: string;
  pickupPointState: string;
  status: string;
  createdAt: string;
  labelStatus?: string;
}

interface PendingShipmentsResponse {
  items: PendingShipment[];
  total: number;
  hasMore: boolean;
}

async function fetchPendingShipments(): Promise<PendingShipmentsResponse> {
  const response = await fetch('/api/dashboard/pending-pickup-shipments?limit=5');
  if (!response.ok) {
    throw new Error('Failed to fetch pending shipments');
  }
  return response.json();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function PendingPickupPointShipments() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-pending-pickup-shipments'],
    queryFn: fetchPendingShipments,
    staleTime: 60_000, // 1 minuto
  });

  const shipments = data?.items || [];
  const total = data?.total || 0;
  const hasMore = data?.hasMore || false;

  const cardTitle = (
    <Flex align="center" gap={8}>
      <PrinterOutlined />
      <Text strong>Aguardando Postagem</Text>
      {total > 0 && <Badge count={total} />}
    </Flex>
  );

  if (isLoading) {
    return (
      <Card title={cardTitle} variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <Card
      title={cardTitle}
      variant="outlined"
      extra={
        hasMore && (
          <Button
            type="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/shipments?status=Aguardando%20postagem')}
          >
            Ver todos
          </Button>
        )
      }
    >
      {total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Flex vertical gap={4}>
              <Text>Nenhum envio aguardando postagem.</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Quando você criar um envio para entregar em ponto de coleta, ele aparecerá aqui.
              </Text>
            </Flex>
          }
        />
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
            Leve os envios até o ponto de coleta indicado para postagem.
          </Text>
          <List
            size="small"
            dataSource={shipments}
            renderItem={(shipment) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/shipments/${shipment.id}`)}
              >
                <Flex justify="space-between" align="center" style={{ width: '100%' }} gap={12}>
                  <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" gap={4}>
                      <InboxOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                      <Text strong style={{ fontSize: '13px' }}>
                        {shipment.trackingCode}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        • {shipment.pickupPointName}
                      </Text>
                    </Flex>
                    <Flex align="center" gap={4}>
                      <EnvironmentOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                      <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                        {shipment.pickupPointCity}/{shipment.pickupPointState}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        • Criado em {formatDate(shipment.createdAt)}
                      </Text>
                    </Flex>
                  </Flex>

                  <Tag color="blue" style={{ fontSize: '10px' }}>
                    Aguard. postagem
                  </Tag>
                </Flex>
              </List.Item>
            )}
          />
        </>
      )}
    </Card>
  );
}
