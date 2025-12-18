'use client';

import { Suspense, useState, useMemo } from 'react';
import { Grid, Skeleton } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewTicketList } from '@/modules/support/ui/components/NewTicketList';
import { TicketDetailsDrawer } from '@/modules/support/ui/components/TicketDetailsDrawer';
import { PageShell } from '@/shared/ui/PageShell';

export default function SuporteAdminClient() {
  return (
    <Suspense fallback={<AdminSupportPageSkeleton />}>
      <AdminSupportPageContent />
    </Suspense>
  );
}

function AdminSupportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isComposing, setIsComposing] = useState(false);
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.lg ?? false;

  // Derivar selectedTicketId dos searchParams e isDesktop (sem useEffect)
  const selectedTicketId = useMemo(() => {
    if (!isDesktop) return null;
    return searchParams.get('ticket');
  }, [searchParams, isDesktop]);

  const handleSelectTicket = (ticketId: string) => {
    if (isDesktop) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('ticket', ticketId);
      const query = params.toString();
      router.replace('/admin/suporte?' + query);
    } else {
      router.push('/admin/suporte/' + ticketId);
    }
  };

  const handleCloseDrawer = () => {
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
