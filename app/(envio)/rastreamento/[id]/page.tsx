import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const RastreamentoDetailClient = dynamic(() => import('./RastreamentoDetailClient'));

export default async function RastreamentoDetailPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RastreamentoDetailClient />
    </Suspense>
  );
}
