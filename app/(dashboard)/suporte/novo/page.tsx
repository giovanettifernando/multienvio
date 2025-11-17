'use client';

import { Card } from 'antd';
import { useRouter } from 'next/navigation';
import { SupportForm } from '@/components/support/SupportForm';
import { PageShell } from '@/components/shared/PageShell';

export default function NovoTicketPage() {
  const router = useRouter();

  const handleSuccess = (ticketId: string) => {
    router.push(`/suporte?ticket=${ticketId}`);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <PageShell title="Abrir Novo Chamado" gap="md">
        <Card>
          <SupportForm onSuccess={handleSuccess} />
        </Card>
      </PageShell>
    </div>
  );
}
