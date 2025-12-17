'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OpenRouterClient = dynamic(() => import('./OpenRouterClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <OpenRouterClient />
    </Suspense>
  );
}
