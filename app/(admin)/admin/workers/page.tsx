import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import WorkersClient from './WorkersClient';

export default async function WorkersPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <WorkersClient />
    </Suspense>
  );
}
