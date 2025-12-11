'use client';

import { Typography, Tag, Skeleton, Badge, Divider } from 'antd';
import { RightOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';
import { ELButton } from '@/components/ui/ELButton';
import { ELCard } from '@/components/ui/ELCard';
import { ELFlex } from '@/components/ui/ELGrid';
import { ELEmpty } from '@/components/ui/ELEmpty';

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
    <ELFlex align="center" gap="sm">
      <MailOutlined />
      <Text strong>Aguardando Postagem</Text>
      {total > 0 && <Badge count={total} />}
    </ELFlex>
  );

  if (isLoading) {
    return (
      <ELCard header={{ title: cardTitle }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </ELCard>
    );
  }

  return (
    <ELCard
      header={{
        title: cardTitle,
        extra: hasMore ? (
          <ELButton
            variant="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/shipments?status=Aguardando%20postagem')}
          >
            Ver todos
          </ELButton>
        ) : undefined,
      }}
    >
      {total === 0 ? (
        <ELEmpty
          description={
            <ELFlex direction="col" gap="sm">
              <Text>Nenhum envio aguardando postagem.</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Quando você criar um envio para entregar em ponto de coleta, ele aparecerá aqui.
              </Text>
            </ELFlex>
          }
        />
      ) : (
        <ELFlex direction="col" gap="sm">
          {shipments.map((shipment, index) => (
            <div
              key={shipment.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/shipments/${shipment.id}`)}
            >
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <ELFlex justify="between" align="center" style={{ width: '100%' }} gap="md">
                <ELFlex direction="col" style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    {shipment.trackingCode}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                    {shipment.pickupPointName}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {shipment.pickupPointCity}/{shipment.pickupPointState} • {formatDate(shipment.createdAt)}
                  </Text>
                </ELFlex>

                <Tag color="blue" style={{ fontSize: '10px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
                  Aguard. postagem
                </Tag>
              </ELFlex>
            </div>
          ))}
        </ELFlex>
      )}
    </ELCard>
  );
}
