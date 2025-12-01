import { Suspense } from 'react';
import { connection } from 'next/server';
import PickupDetailLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function PickupDetailPage() {
  await connection();
  return (
    <Suspense fallback={<PickupDetailLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
