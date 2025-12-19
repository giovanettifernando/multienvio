import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import MetodosLoading from './loading';

const MetodosClient = dynamic(() => import('./MetodosClient'));

export default async function MetodosPage() {
  await connection();
  return (
    <Suspense fallback={<MetodosLoading />}>
      <MetodosClient />
    </Suspense>
  );
}
