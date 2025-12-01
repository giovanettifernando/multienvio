'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RelatoriosClient = dynamic(() => import('./RelatoriosClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RelatoriosClient />
    </Suspense>
  );
}
