import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const NovaColetaClient = dynamic(() => import('./NovaColetaClient'));

export default async function NovaColetaPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <NovaColetaClient />
    </Suspense>
  );
}
