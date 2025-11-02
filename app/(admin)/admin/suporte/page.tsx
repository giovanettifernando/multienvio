'use client';

import { Suspense, useEffect, useState } from 'react';
import { Space, Typography, Grid, Skeleton } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/components/support/NewTicketList';
import { TicketDetailsDrawer } from '@/components/support/TicketDetailsDrawer';

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<AdminSupportPageSkeleton />}>
      <AdminSupportPageContent />
    </Suspense>
  );
}

function AdminSupportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.lg ?? false;

  // Handle ticket query param
  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId && isDesktop) {
      setSelectedTicketId(ticketId);
      return;
    }
    setSelectedTicketId(null);
    setIsComposing(false);
  }, [searchParams, isDesktop]);

  // Close drawer on mobile
  useEffect(() => {
    if (!isDesktop) {
      setSelectedTicketId(null);
      setIsComposing(false);
    }
  }, [isDesktop]);

  const handleSelectTicket = (ticketId: string) => {
    if (isDesktop) {
      setSelectedTicketId(ticketId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('ticket', ticketId);
      const query = params.toString();
      router.replace('/admin/suporte?' + query);
    } else {
      router.push('/admin/suporte/' + ticketId);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedTicketId(null);
    setIsComposing(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('ticket');
    const query = params.toString();
    router.replace('/admin/suporte' + (query ? '?' + query : ''));
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%', padding: 24 }}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Suporte
        </Typography.Title>
        <Typography.Text type="secondary">
          Acompanhe os chamados abertos pelos clientes e responda rapidamente.
        </Typography.Text>
      </Space>

      <NewTicketList
        onTicketClick={handleSelectTicket}
        audience="admin"
        showRequester
        isComposing={isComposing}
      />

      <TicketDetailsDrawer
        ticketId={selectedTicketId}
        open={isDesktop && !!selectedTicketId}
        onClose={handleCloseDrawer}
        userRole="admin"
        onComposingChange={setIsComposing}
      />
    </Space>
  );
}

function AdminSupportPageSkeleton() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%', padding: 24 }}>
      <Skeleton active title paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </Space>
  );
}
