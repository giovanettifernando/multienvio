'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminClientDetailsClient = dynamic(() => import('./AdminClientDetailsClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminClientDetailsClient />
    </Suspense>
  );
}
