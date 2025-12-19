import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const SupportClient = dynamic(() => import('./SupportClient'));

export default async function SupportPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <SupportClient />
    </Suspense>
  );
}
