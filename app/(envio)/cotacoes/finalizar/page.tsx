import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import FinalizarLoading from './loading';

const FinalizarClient = dynamic(() => import('./FinalizarClient'));

export default async function FinalizarPage() {
  await connection();
  return (
    <Suspense fallback={<FinalizarLoading />}>
      <FinalizarClient />
    </Suspense>
  );
}
