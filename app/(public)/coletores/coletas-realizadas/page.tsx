import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ColetasRealizadasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ClientWrapper />
    </Suspense>
  );
}
