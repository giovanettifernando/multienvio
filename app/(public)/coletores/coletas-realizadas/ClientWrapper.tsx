'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ColetasRealizadasClient = dynamic(() => import('./ColetasRealizadasClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ColetasRealizadasClient />
    </Suspense>
  );
}
