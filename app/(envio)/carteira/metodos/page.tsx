import { Suspense } from 'react';
import { connection } from 'next/server';
import MetodosLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function MetodosPage() {
  await connection();
  return (
    <Suspense fallback={<MetodosLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
