'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ForgotPasswordClient = dynamic(() => import('./ForgotPasswordClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
