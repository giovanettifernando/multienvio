'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const RedefinirSenhaClient = dynamic(() => import('./RedefinirSenhaClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaClient />
    </Suspense>
  );
}
