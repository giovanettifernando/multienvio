/**
 * Pontos De Coleta - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import PickupPointsClient from './PickupPointsClient';

export default async function PickupPointsPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <PickupPointsClient />
    </Suspense>
  );
}
