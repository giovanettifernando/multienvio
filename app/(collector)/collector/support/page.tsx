'use client';

import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Space, Typography } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/components/support/NewTicketList';
import { TicketDetailsDrawer } from '@/components/support/TicketDetailsDrawer';

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
    <Space direction="vertical" style={{ width: '100%' }} size={24}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <Space direction="vertical" size={0}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Central de Suporte
          </Typography.Title>
          <Typography.Text type="secondary">
            Acompanhe seus chamados e interaja com nossa equipe.
          </Typography.Text>
        </Space>
        <Button
          type="primary"
          variant="solid"
          icon={<PlusOutlined />}
          onClick={() => router.push('/collector/support/novo')}
        >
          Abrir ticket
        </Button>
      </Flex>

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
    </Space>
  );
}
