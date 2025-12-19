/**
 * Financeiro > Relatorios - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import RelatoriosClient from './RelatoriosClient';

export default async function RelatoriosPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RelatoriosClient />
    </Suspense>
  );
}
