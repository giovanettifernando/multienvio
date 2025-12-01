'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AdminDashboardClient = dynamic(() => import('./AdminDashboardClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardClient />
    </Suspense>
  );
}
