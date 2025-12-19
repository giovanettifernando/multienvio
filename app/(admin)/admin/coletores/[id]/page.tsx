/**
 * Coletores > [Id] - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import CollectorDetailClient from './CollectorDetailClient';

export default async function CollectorDetailPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <CollectorDetailClient />
    </Suspense>
  );
}
