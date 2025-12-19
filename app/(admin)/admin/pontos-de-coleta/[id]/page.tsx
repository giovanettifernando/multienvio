/**
 * Pontos De Coleta > [Id] - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminPickupPointDetailsClient from './AdminPickupPointDetailsClient';

export default async function AdminPickupPointDetailsPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminPickupPointDetailsClient />
    </Suspense>
  );
}
