/**
 * Financeiro > Movimentacoes - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import MovimentacoesClient from './MovimentacoesClient';

export default async function MovimentacoesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <MovimentacoesClient />
    </Suspense>
  );
}
