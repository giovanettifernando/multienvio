import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const SuporteClient = dynamic(() => import('./SuporteClient'));

export default async function SuportePage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <SuporteClient />
    </Suspense>
  );
}
