'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminConfigClient = dynamic(() => import('./AdminConfigClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminConfigClient />
    </Suspense>
  );
}
