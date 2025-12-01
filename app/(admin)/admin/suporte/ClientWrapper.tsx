'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const SuporteAdminClient = dynamic(() => import('./SuporteAdminClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <SuporteAdminClient />
    </Suspense>
  );
}
