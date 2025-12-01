'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const TicketDetailClient = dynamic(() => import('./TicketDetailClient'), { ssr: false });

export default function ClientWrapper({ params }: { params?: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <TicketDetailClient params={params} />
    </Suspense>
  );
}
