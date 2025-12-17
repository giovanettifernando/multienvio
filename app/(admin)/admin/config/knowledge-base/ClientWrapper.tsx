'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const KnowledgeBaseClient = dynamic(() => import('./KnowledgeBaseClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <KnowledgeBaseClient />
    </Suspense>
  );
}
