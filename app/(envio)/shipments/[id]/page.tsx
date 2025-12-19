import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const ShipmentDetailClient = dynamic(() => import('./ShipmentDetailClient'));

export default async function ShipmentDetailPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ShipmentDetailClient />
    </Suspense>
  );
}
