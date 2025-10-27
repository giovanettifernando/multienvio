'use client';

import { Card, Button, Flex, Typography, Empty, Spin, Descriptions } from 'antd';
import { ReloadOutlined, ApiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import { useHealth, useTestConnection, useCarriers } from '@/lib/integrations/hooks';
import ServiceStatusBadge from './ServiceStatusBadge';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { Text } = Typography;

export default function HealthPanel() {
  const { data: healthData, isLoading, refetch } = useHealth();
  const { data: carriers } = useCarriers();
  const testConnection = useTestConnection();

  const handleRefresh = () => {
    refetch();
  };

  const handleTest = (carrierId: string) => {
    testConnection.mutate(carrierId);
  };

  const getCarrierName = (carrierId: string) => {
    const carrier = carriers?.find((c) => c.id === carrierId);
    return carrier?.name || carrierId;
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: 200 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!healthData || healthData.length === 0) {
    return (
      <Empty
        description="Nenhuma integração para monitorar"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="flex-end">
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={isLoading}
        >
          Atualizar status
        </Button>
      </Flex>

      <Flex gap={16} wrap="wrap">
        {healthData.map((health) => (
          <Card
            key={health.carrierId}
            title={
              <Flex align="center" gap={8}>
                <ServiceStatusBadge status={health.status} showBadge={false} />
                <Text strong>{getCarrierName(health.carrierId)}</Text>
              </Flex>
            }
            extra={
              <Button
                size="small"
                icon={<ApiOutlined />}
                onClick={() => handleTest(health.carrierId)}
                loading={testConnection.isPending}
              >
                Testar
              </Button>
            }
            style={{ minWidth: 320, flex: 1 }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <ServiceStatusBadge status={health.status} />
              </Descriptions.Item>

              {health.latencyMs !== undefined && (
                <Descriptions.Item label="Latência">
                  <Text type={health.latencyMs > 1000 ? 'warning' : 'success'}>
                    {health.latencyMs}ms
                  </Text>
                </Descriptions.Item>
              )}

              {health.lastCheckedAt && (
                <Descriptions.Item label="Último teste">
                  <Text type="secondary">
                    {dayjs(health.lastCheckedAt).fromNow()}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(health.lastCheckedAt).format('DD/MM/YYYY HH:mm:ss')}
                  </Text>
                </Descriptions.Item>
              )}

              {health.message && (
                <Descriptions.Item label="Mensagem">
                  <Text
                    type={health.status === 'up' ? 'success' : 'danger'}
                    style={{ fontSize: 12 }}
                  >
                    {health.message}
                  </Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        ))}
      </Flex>
    </Flex>
  );
}
