'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminUsersClient = dynamic(() => import('./AdminUsersClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminUsersClient />
    </Suspense>
  );
}
