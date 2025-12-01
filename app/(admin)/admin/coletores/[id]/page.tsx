import { Suspense } from 'react';
import { connection } from 'next/server';
import CollectorDetailLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CollectorDetailPage() {
  await connection();
  return (
    <Suspense fallback={<CollectorDetailLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
