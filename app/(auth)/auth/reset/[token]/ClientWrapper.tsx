'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ResetTokenClient = dynamic(() => import('./ResetTokenClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ResetTokenClient />
    </Suspense>
  );
}
