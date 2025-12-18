'use client';

import { Card, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { SupportForm } from '@/modules/support/ui/components/SupportForm';

const { Title, Text } = Typography;

export default function NovoSupportClient() {
  const router = useRouter();

  const handleSuccess = (ticketId: string) => {
    router.push(`/collector/support?ticket=${ticketId}`);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={2}>Abrir Novo Chamado</Title>
          <Text type="secondary">
            Preencha o formulário abaixo para abrir um novo chamado de suporte.
          </Text>
        </div>

        <Card>
          <SupportForm onSuccess={handleSuccess} audience="collector" />
        </Card>
      </Space>
    </div>
  );
}
