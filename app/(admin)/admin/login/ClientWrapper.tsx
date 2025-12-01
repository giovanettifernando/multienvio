'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminLoginClient = dynamic(() => import('./AdminLoginClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminLoginClient />
    </Suspense>
  );
}
