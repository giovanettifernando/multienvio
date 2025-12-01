'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const EsqueciSenhaClient = dynamic(() => import('./EsqueciSenhaClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <EsqueciSenhaClient />
    </Suspense>
  );
}
