'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';

const EnvioLayoutClient = dynamic(() => import('./EnvioLayoutClient'), {
  ssr: false,
});

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', padding: 24 }}>
        <ELSkeleton active paragraph={{ rows: 6 }} />
      </div>
    }>
      <EnvioLayoutClient>{children}</EnvioLayoutClient>
    </Suspense>
  );
}
