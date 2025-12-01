'use client';

import { Card, Typography, Tag, Skeleton, Empty, Button, Flex, Badge, Divider } from 'antd';
import { EnvironmentOutlined, RightOutlined, InboxOutlined, PrinterOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';

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
  return apiFetch('/api/dashboard/pending-pickup-shipments?limit=5');
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
          <Flex vertical gap={0}>
            {shipments.map((shipment, index) => (
              <div
                key={shipment.id}
                style={{ cursor: 'pointer', padding: '12px 0' }}
                onClick={() => router.push(`/shipments/${shipment.id}`)}
              >
                {index > 0 && <Divider style={{ margin: '0 0 12px 0' }} />}
                <Flex vertical style={{ width: '100%' }} gap={8}>
                  {/* Linha 1: Código + Tag */}
                  <Flex justify="space-between" align="center" wrap gap={8}>
                    <Flex align="center" gap={4} style={{ minWidth: 0 }}>
                      <InboxOutlined style={{ fontSize: '12px', color: '#8c8c8c', flexShrink: 0 }} />
                      <Text strong style={{ fontSize: '13px' }}>
                        {shipment.trackingCode}
                      </Text>
                    </Flex>
                    <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                      Aguard. postagem
                    </Tag>
                  </Flex>

                  {/* Linha 2: Ponto de coleta */}
                  <Text type="secondary" style={{ fontSize: '12px' }} ellipsis>
                    {shipment.pickupPointName}
                  </Text>

                  {/* Linha 3: Localização + Data */}
                  <Flex align="center" gap={8} wrap>
                    <Flex align="center" gap={4}>
                      <EnvironmentOutlined style={{ fontSize: '12px', color: '#8c8c8c', flexShrink: 0 }} />
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {shipment.pickupPointCity}/{shipment.pickupPointState}
                      </Text>
                    </Flex>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      • Criado em {formatDate(shipment.createdAt)}
                    </Text>
                  </Flex>
                </Flex>
              </div>
            ))}
          </Flex>
        </>
      )}
    </Card>
  );
}
