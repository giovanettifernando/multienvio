'use client';

import { PageShell } from '@/shared/ui/PageShell';
import { Flex } from 'antd';
import PaymentGatewayConfig from '@/modules/admin/ui/components/PaymentGatewayConfig';
import PendingPaymentsGrid from '@/modules/admin/ui/components/PendingPaymentsGrid';

export default function PaymentGatewayClient() {
  return (
    <PageShell title="Gateway de Pagamento" gap="lg">
      <Flex vertical gap={24}>
        <PaymentGatewayConfig />
        <PendingPaymentsGrid />
      </Flex>
    </PageShell>
  );
}
