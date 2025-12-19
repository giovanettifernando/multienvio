/**
 * Operacoes - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import OperacoesClient from './OperacoesClient';

export default async function OperacoesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <OperacoesClient />
    </Suspense>
  );
}
