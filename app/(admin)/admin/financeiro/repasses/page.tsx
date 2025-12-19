/**
 * Financeiro > Repasses - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import RepassesClient from './RepassesClient';

export default async function RepassesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RepassesClient />
    </Suspense>
  );
}
