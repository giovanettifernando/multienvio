'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ConfirmacaoClient = dynamic(() => import('./ConfirmacaoClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ConfirmacaoClient />
    </Suspense>
  );
}
