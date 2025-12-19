import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import PickupDetailLoading from './loading';

const PickupDetailClient = dynamic(() => import('./PickupDetailClient'));

export default async function PickupDetailPage() {
  await connection();
  return (
    <Suspense fallback={<PickupDetailLoading />}>
      <PickupDetailClient />
    </Suspense>
  );
}
