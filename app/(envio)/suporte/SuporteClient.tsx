'use client';

import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { ELCard } from '@/shared/ui/ELCard';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/modules/support/ui/components/NewTicketList';
import { TicketDetailsDrawer } from '@/modules/support/ui/components/TicketDetailsDrawer';
import { SupportFAQ } from '@/modules/support/ui/components/SupportFAQ';
import { PageShell } from '@/shared/ui/PageShell';
import { ELButton } from '@/shared/ui/ELButton';

export default function SuporteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Derivar o ticketId diretamente dos searchParams (não precisa de estado separado)
  const selectedTicketId = searchParams.get('ticket');
  const [isComposing, setIsComposing] = useState(false);

  const handleOpenTicket = (id: string) => {
    router.push(`/suporte?ticket=${id}`);
  };

  const handleCloseDrawer = () => {
    setIsComposing(false);
    router.push('/suporte');
  };

  return (
    <PageShell
      title="Central de Suporte"
      gap="md"
      extra={
        <ELButton
          variant="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/suporte/novo')}
        >
          Abrir ticket
        </ELButton>
      }
    >
      {/* Seção FAQ */}
      <ELCard padding="xl">
        <SupportFAQ audience="USER" />
      </ELCard>

      {/* Seção Meus Chamados */}
      <ELCard padding="xl" header={{ title: 'Meus Chamados' }}>
        <NewTicketList onTicketClick={handleOpenTicket} isComposing={isComposing} />
      </ELCard>

      <TicketDetailsDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onClose={handleCloseDrawer}
        userRole="cliente"
        onComposingChange={setIsComposing}
      />
    </PageShell>
  );
}
