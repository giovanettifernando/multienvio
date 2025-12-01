import { Suspense } from 'react';
import { connection } from 'next/server';
import ExtratoLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ExtratoPage() {
  await connection();
  return (
    <Suspense fallback={<ExtratoLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
