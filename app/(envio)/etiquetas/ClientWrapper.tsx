'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const EtiquetasClient = dynamic(() => import('./EtiquetasClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <EtiquetasClient />
    </Suspense>
  );
}
