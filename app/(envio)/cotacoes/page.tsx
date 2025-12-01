import { Suspense } from 'react';
import { connection } from 'next/server';
import CotacoesLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CotacoesPage() {
  await connection();
  return (
    <Suspense fallback={<CotacoesLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
