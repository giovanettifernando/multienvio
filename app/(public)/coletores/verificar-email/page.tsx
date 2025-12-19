import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const VerificarEmailClient = dynamic(() => import('./VerificarEmailClient'));

export default async function VerificarEmailPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <VerificarEmailClient />
    </Suspense>
  );
}
