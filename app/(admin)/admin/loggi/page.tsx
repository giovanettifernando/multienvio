/**
 * Loggi - Server Component
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import LoggiClient from './LoggiClient';

export default async function LoggiPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <LoggiClient />
    </Suspense>
  );
}
