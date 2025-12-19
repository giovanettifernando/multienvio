import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import FaturasLoading from './loading';

const FaturasClient = dynamic(() => import('./FaturasClient'));

export default async function FaturasPage() {
  await connection();
  return (
    <Suspense fallback={<FaturasLoading />}>
      <FaturasClient />
    </Suspense>
  );
}
