import { Suspense } from 'react';
import { connection } from 'next/server';
import SuporteLoading from './loading';
import dynamic from 'next/dynamic';

const SuporteClient = dynamic(() => import('./SuporteClient'));

export default async function SuportePage() {
  await connection();
  return (
    <Suspense fallback={<SuporteLoading />}>
      <SuporteClient />
    </Suspense>
  );
}
