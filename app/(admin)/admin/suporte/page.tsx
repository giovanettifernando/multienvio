/**
 * Suporte - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import SuporteAdminClient from './SuporteAdminClient';

export default async function SuporteAdminPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <SuporteAdminClient />
    </Suspense>
  );
}
