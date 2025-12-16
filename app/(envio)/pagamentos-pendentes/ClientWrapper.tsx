'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RecipientPaymentsClient = dynamic(() => import('./RecipientPaymentsClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RecipientPaymentsClient />
    </Suspense>
  );
}
