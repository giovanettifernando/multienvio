'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ColetoresDashClient = dynamic(() => import('./ColetoresDashClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ColetoresDashClient />
    </Suspense>
  );
}
