/**
 * Financeiro > Comissoes - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import ComissoesFinanceiroClient from './ComissoesFinanceiroClient';

export default async function ComissoesFinanceiroPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ComissoesFinanceiroClient />
    </Suspense>
  );
}
