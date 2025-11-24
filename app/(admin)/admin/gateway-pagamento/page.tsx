'use client';

import { PageShell } from '@/components/shared/PageShell';
import { Flex } from 'antd';
import PaymentGatewayConfig from '@/components/admin/PaymentGatewayConfig';
import PendingPaymentsGrid from '@/components/admin/PendingPaymentsGrid';

export default function GatewayPagamentoPage() {
  return (
    <PageShell title="Gateway de Pagamento" gap="lg">
      <Flex vertical gap={24}>
        <PaymentGatewayConfig />
        <PendingPaymentsGrid />
      </Flex>
    </PageShell>
  );
}
