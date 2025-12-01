'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CarteiraClient = dynamic(() => import('./CarteiraClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CarteiraClient />
    </Suspense>
  );
}
