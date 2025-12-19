import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import CotacoesLoading from './loading';

const CotacoesClient = dynamic(() => import('./CotacoesClient'));

export default async function CotacoesPage() {
  await connection();
  return (
    <Suspense fallback={<CotacoesLoading />}>
      <CotacoesClient />
    </Suspense>
  );
}
