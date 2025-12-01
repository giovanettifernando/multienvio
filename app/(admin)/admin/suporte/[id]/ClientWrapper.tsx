'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminSupportTicketClient = dynamic(() => import('./AdminSupportTicketClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminSupportTicketClient />
    </Suspense>
  );
}
