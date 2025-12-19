import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import ExtratoLoading from './loading';

const ExtratoClient = dynamic(() => import('./ExtratoClient'));

export default async function ExtratoPage() {
  await connection();
  return (
    <Suspense fallback={<ExtratoLoading />}>
      <ExtratoClient />
    </Suspense>
  );
}
