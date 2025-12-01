import { Suspense } from 'react';
import { connection } from 'next/server';
import ColetoresLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ColetoresPage() {
  await connection();
  return (
    <Suspense fallback={<ColetoresLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
