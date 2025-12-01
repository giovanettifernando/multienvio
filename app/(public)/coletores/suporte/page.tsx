import { Suspense } from 'react';
import { connection } from 'next/server';
import SuporteLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function SuportePage() {
  await connection();
  return (
    <Suspense fallback={<SuporteLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
