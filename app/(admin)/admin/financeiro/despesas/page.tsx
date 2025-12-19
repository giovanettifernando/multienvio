/**
 * Financeiro > Despesas - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import DespesasClient from './DespesasClient';

export default async function DespesasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <DespesasClient />
    </Suspense>
  );
}
