import { Suspense } from 'react';
import { connection } from 'next/server';
import FinalizarLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function FinalizarPage() {
  await connection();
  return (
    <Suspense fallback={<FinalizarLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
