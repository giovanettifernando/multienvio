'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const GoogleOAuthClient = dynamic(() => import('./GoogleOAuthClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <GoogleOAuthClient />
    </Suspense>
  );
}
