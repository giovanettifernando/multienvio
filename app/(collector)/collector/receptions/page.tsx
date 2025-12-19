import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const ReceptionsClient = dynamic(() => import('./ReceptionsClient'));

export default async function ReceptionsPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ReceptionsClient />
    </Suspense>
  );
}
