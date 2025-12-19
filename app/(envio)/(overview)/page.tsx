import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import OverviewLoading from './loading';

const OverviewClient = dynamic(() => import('./OverviewClient'));

export default async function OverviewPage() {
  await connection();
  return (
    <Suspense fallback={<OverviewLoading />}>
      <OverviewClient />
    </Suspense>
  );
}
