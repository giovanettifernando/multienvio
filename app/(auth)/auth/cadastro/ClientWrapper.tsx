'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CadastroClient = dynamic(() => import('./CadastroClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <CadastroClient />
    </Suspense>
  );
}
