import { Suspense } from 'react';
import { connection } from 'next/server';
import OverviewLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function OverviewPage() {
  await connection();
  return (
    <Suspense fallback={<OverviewLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
