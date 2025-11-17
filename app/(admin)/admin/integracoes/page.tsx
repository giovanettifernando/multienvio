'use client';

import { Tabs } from 'antd';
import { ApiOutlined, LinkOutlined, LockOutlined, CreditCardOutlined, HeartOutlined } from '@ant-design/icons';
import CarrierTable from '@/components/integrations/CarrierTable';
import CarrierDrawer from '@/components/integrations/CarrierDrawer';
import ApiTable from '@/components/integrations/ApiTable';
import ApiDrawer from '@/components/integrations/ApiDrawer';
import AuthPanel from '@/components/integrations/AuthPanel';
import PaymentGatewayTab from '@/components/integrations/PaymentGatewayTab';
import HealthPanel from '@/components/integrations/HealthPanel';
import { PageShell } from '@/components/shared/PageShell';

export default function IntegrationsPage() {
  const tabItems = [
    {
      key: 'carriers',
      label: (
        <span>
          <ApiOutlined />
          Transportadoras
        </span>
      ),
      children: (
        <>
          <CarrierTable />
          <CarrierDrawer />
        </>
      ),
    },
    {
      key: 'apis',
      label: (
        <span>
          <LinkOutlined />
          APIs & Endpoints
        </span>
      ),
      children: (
        <>
          <ApiTable />
          <ApiDrawer />
        </>
      ),
    },
    {
      key: 'auth',
      label: (
        <span>
          <LockOutlined />
          Autenticação
        </span>
      ),
      children: <AuthPanel />,
    },
    {
      key: 'payment',
      label: (
        <span>
          <CreditCardOutlined />
          Gate de Pagamento
        </span>
      ),
      children: <PaymentGatewayTab />,
    },
    {
      key: 'health',
      label: (
        <span>
          <HeartOutlined />
          Status & Saúde
        </span>
      ),
      children: <HealthPanel />,
    },
  ];

  return (
    <PageShell title="Integrações" gap="md">
      <Tabs
        items={tabItems}
        defaultActiveKey="carriers"
        type="line"
        size="large"
      />
    </PageShell>
  );
}
