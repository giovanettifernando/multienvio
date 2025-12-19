/**
 * Config > Correios Agencies - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import CorreiosAgenciesClient from './CorreiosAgenciesClient';

export default async function CorreiosAgenciesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <CorreiosAgenciesClient />
    </Suspense>
  );
}
