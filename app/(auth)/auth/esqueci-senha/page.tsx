import { Suspense } from 'react';
import { connection } from 'next/server';
import EsqueciSenhaLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function EsqueciSenhaPage() {
  await connection();
  return (
    <Suspense fallback={<EsqueciSenhaLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
