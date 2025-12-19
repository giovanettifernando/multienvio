import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const RastreamentoClient = dynamic(() => import('./RastreamentoClient'));

export default async function RastreamentoPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RastreamentoClient />
    </Suspense>
  );
}
