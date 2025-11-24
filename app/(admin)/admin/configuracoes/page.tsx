'use client';

import { PageShell } from '@/components/shared/PageShell';
import { Tabs } from 'antd';
import { MailOutlined, CreditCardOutlined } from '@ant-design/icons';
import EmailConfigForm from '@/components/admin/EmailConfigForm';
import PaymentGatewayConfig from '@/components/admin/PaymentGatewayConfig';

export default function ConfiguracoesPage() {
  const items = [
    {
      key: 'email',
      label: (
        <span>
          <MailOutlined />
          Email
        </span>
      ),
      children: <EmailConfigForm />,
    },
    {
      key: 'pagamento',
      label: (
        <span>
          <CreditCardOutlined />
          Gateway de Pagamento
        </span>
      ),
      children: <PaymentGatewayConfig />,
    },
  ];

  return (
    <PageShell title="Configurações" gap="lg">
      <Tabs defaultActiveKey="email" items={items} />
    </PageShell>
  );
}
