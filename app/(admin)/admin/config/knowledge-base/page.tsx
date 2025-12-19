/**
 * Config > Knowledge Base - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import KnowledgeBaseClient from './KnowledgeBaseClient';

export default async function KnowledgeBasePage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <KnowledgeBaseClient />
    </Suspense>
  );
}
