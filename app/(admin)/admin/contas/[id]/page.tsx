/**
 * Contas > [Id] - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminClientDetailsClient from './AdminClientDetailsClient';

export default async function AdminClientDetailsPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminClientDetailsClient />
    </Suspense>
  );
}
