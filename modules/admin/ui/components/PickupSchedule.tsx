'use client';

import { Typography, Tag, Skeleton, Divider } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/utils/api-fetch';
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { ELFlex } from '@/shared/ui/ELGrid';
import { ELEmpty } from '@/shared/ui/ELEmpty';

const { Text } = Typography;

interface ScheduledPickup {
  id: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  scheduleAt: string | null;
  status: string;
  shipment: {
    id: string;
    trackingCode: string;
    carrier: string | null;
  };
  collector: {
    id: string;
    name: string;
  } | null;
}

interface PickupResponse {
  items: ScheduledPickup[];
  total: number;
}

async function fetchScheduledPickups(): Promise<PickupResponse> {
  return apiFetch('/api/coletas?status=SCHEDULED&pageSize=5');
}

function formatScheduleDate(dateString: string | null): string {
  if (!dateString) return 'A definir';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PickupSchedule() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['pickups-scheduled'],
    queryFn: fetchScheduledPickups,
    staleTime: 90_000,
  });

  const pickups = data?.items || [];
  const total = data?.total || 0;

  const cardTitle = (
    <ELFlex align="center" gap="sm">
      <CalendarOutlined />
      <Text strong>Coletas Agendadas</Text>
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
        extra: total > 0 ? (
          <ELButton
            variant="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/coletas?status=SCHEDULED')}
          >
            Ver todas
          </ELButton>
        ) : undefined,
      }}
    >
      {pickups.length === 0 ? (
        <ELEmpty description="Nenhuma coleta agendada" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pickups.map((pickup, index) => (
            <div
              key={pickup.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/coletas/${pickup.id}`)}
            >
              {index > 0 && <Divider style={{ margin: '4px 0' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ fontSize: '11px', color: 'var(--el-text-muted, #98A2B3)' }} />
                    <Text strong style={{ fontSize: '12px' }}>
                      {formatScheduleDate(pickup.scheduleAt)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <EnvironmentOutlined style={{ fontSize: '11px', color: 'var(--el-text-muted, #98A2B3)' }} />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {pickup.originCity && pickup.originUf
                        ? `${pickup.originCity}/${pickup.originUf}`
                        : pickup.originCep}
                      {pickup.collector && ` • ${pickup.collector.name}`}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: '10px', marginLeft: 17 }}>
                    {pickup.shipment.trackingCode}
                    {pickup.shipment.carrier && ` • ${pickup.shipment.carrier}`}
                  </Text>
                </div>

                <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                  Agendada
                </Tag>
              </div>
            </div>
          ))}
        </div>
      )}
    </ELCard>
  );
}
