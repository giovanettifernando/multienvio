import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const ColetasClient = dynamic(() => import('./ColetasClient'));

export default async function ColetasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ColetasClient />
    </Suspense>
  );
}
