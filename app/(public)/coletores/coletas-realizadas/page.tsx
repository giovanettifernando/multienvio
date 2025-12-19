import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const ColetasRealizadasClient = dynamic(() => import('./ColetasRealizadasClient'));

export default async function ColetasRealizadasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ColetasRealizadasClient />
    </Suspense>
  );
}
