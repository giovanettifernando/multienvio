'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const NovoSupportClient = dynamic(() => import('./NovoSupportClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <NovoSupportClient />
    </Suspense>
  );
}
