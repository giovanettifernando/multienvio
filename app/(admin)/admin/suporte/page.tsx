'use client';

import { Suspense, useEffect, useState } from 'react';
import { Grid, Skeleton } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/components/support/NewTicketList';
import { TicketDetailsDrawer } from '@/components/support/TicketDetailsDrawer';
import { PageShell } from '@/components/shared/PageShell';

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
    <PageShell title="Suporte" gap="md">
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
    </PageShell>
  );
}

function AdminSupportPageSkeleton() {
  return (
    <PageShell title="Suporte" gap="md">
      <Skeleton active paragraph={{ rows: 6 }} />
    </PageShell>
  );
}
