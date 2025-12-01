import { Suspense } from 'react';
import { connection } from 'next/server';
import FaturasLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function FaturasPage() {
  await connection();
  return (
    <Suspense fallback={<FaturasLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
