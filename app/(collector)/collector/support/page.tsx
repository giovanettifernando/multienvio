'use client';

import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/components/support/NewTicketList';
import { TicketDetailsDrawer } from '@/components/support/TicketDetailsDrawer';
import { PageShell } from '@/components/shared/PageShell';

export default function CollectorSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId) {
      setSelectedTicketId(ticketId);
      return;
    }
    setSelectedTicketId(null);
    setIsComposing(false);
  }, [searchParams]);

  const handleOpenTicket = (id: string) => {
    setSelectedTicketId(id);
    router.push(`/collector/support?ticket=${id}`);
  };

  const handleCloseDrawer = () => {
    setSelectedTicketId(null);
    setIsComposing(false);
    router.push('/collector/support');
  };

  return (
    <PageShell
      title="Central de Suporte"
      gap="md"
      extra={
        <Button
          type="primary"
          variant="solid"
          icon={<PlusOutlined />}
          onClick={() => router.push('/collector/support/novo')}
        >
          Abrir ticket
        </Button>
      }
    >
      <Card variant="borderless" styles={{ body: { padding: 24 } }}>
        <NewTicketList
          onTicketClick={handleOpenTicket}
          isComposing={isComposing}
          audience="collector"
        />
      </Card>

      <TicketDetailsDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onClose={handleCloseDrawer}
        userRole="cliente"
        audience="collector"
        onComposingChange={setIsComposing}
      />
    </PageShell>
  );
}
