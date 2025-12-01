'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const NovoSuporteClient = dynamic(() => import('./NovoSuporteClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <NovoSuporteClient />
    </Suspense>
  );
}
