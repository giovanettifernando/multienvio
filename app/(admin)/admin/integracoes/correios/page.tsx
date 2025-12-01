import { Suspense } from 'react';
import { connection } from 'next/server';
import CorreiosLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CorreiosPage() {
  await connection();
  return (
    <Suspense fallback={<CorreiosLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
