'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const LogoutClient = dynamic(() => import('./LogoutClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <LogoutClient />
    </Suspense>
  );
}
