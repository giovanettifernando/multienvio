import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const ColetoresDashClient = dynamic(() => import('./ColetoresDashClient'));

export default async function ColetoresDashPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ColetoresDashClient />
    </Suspense>
  );
}
