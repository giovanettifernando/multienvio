'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const MetodosClient = dynamic(() => import('./MetodosClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <MetodosClient />
    </Suspense>
  );
}
