import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const ColetasColetorClient = dynamic(() => import('./ColetasColetorClient'));

export default async function ColetasColetorPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ColetasColetorClient />
    </Suspense>
  );
}
