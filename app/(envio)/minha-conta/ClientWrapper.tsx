'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const MinhaContaClient = dynamic(() => import('./MinhaContaClient'), { ssr: false });

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <MinhaContaClient />
    </Suspense>
  );
}
