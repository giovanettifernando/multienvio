'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ComissoesFinanceiroClient = dynamic(() => import('./ComissoesFinanceiroClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ComissoesFinanceiroClient />
    </Suspense>
  );
}
