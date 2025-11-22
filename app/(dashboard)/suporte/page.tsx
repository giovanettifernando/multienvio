'use client';

import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/components/support/NewTicketList';
import { TicketDetailsDrawer } from '@/components/support/TicketDetailsDrawer';
import { PageShell } from '@/components/shared/PageShell';

export default function SupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Handle ticket query param
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
    router.push(`/suporte?ticket=${id}`);
  };

  const handleCloseDrawer = () => {
    setSelectedTicketId(null);
    setIsComposing(false);
    router.push('/suporte');
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
          onClick={() => router.push('/suporte/novo')}
        >
          Abrir ticket
        </Button>
      }
    >
      <Card variant="borderless" styles={{ body: { padding: 24 } }}>
        <NewTicketList onTicketClick={handleOpenTicket} isComposing={isComposing} />
      </Card>

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
