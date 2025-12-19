import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const MinhaContaClient = dynamic(() => import('./MinhaContaClient'));

export default async function MinhaContaPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <MinhaContaClient />
    </Suspense>
  );
}
