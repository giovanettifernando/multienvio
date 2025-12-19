import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const EtiquetasClient = dynamic(() => import('./EtiquetasClient'));

export default async function EtiquetasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <EtiquetasClient />
    </Suspense>
  );
}
