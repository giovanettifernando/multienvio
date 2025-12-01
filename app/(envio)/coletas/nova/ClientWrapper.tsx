'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const NovaColetaClient = dynamic(() => import('./NovaColetaClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <NovaColetaClient />
    </Suspense>
  );
}
