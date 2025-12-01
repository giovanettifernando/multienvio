'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const SupportClient = dynamic(() => import('./SupportClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <SupportClient />
    </Suspense>
  );
}
