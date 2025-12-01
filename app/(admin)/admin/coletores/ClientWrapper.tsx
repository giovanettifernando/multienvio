'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ColetoresClient = dynamic(() => import('./ColetoresClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ColetoresClient />
    </Suspense>
  );
}
