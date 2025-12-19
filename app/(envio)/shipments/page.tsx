import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const ShipmentsClient = dynamic(() => import('./ShipmentsClient'));

export default async function ShipmentsPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ShipmentsClient />
    </Suspense>
  );
}
