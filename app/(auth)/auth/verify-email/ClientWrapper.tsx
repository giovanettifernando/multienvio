'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const VerifyEmailClient = dynamic(() => import('./VerifyEmailClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailClient />
    </Suspense>
  );
}
