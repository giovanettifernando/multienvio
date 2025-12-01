'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CarrinhoClient = dynamic(() => import('./CarrinhoClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CarrinhoClient />
    </Suspense>
  );
}
