import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const CollectorDashClient = dynamic(() => import('./CollectorDashClient'));

export default async function CollectorDashPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <CollectorDashClient />
    </Suspense>
  );
}
