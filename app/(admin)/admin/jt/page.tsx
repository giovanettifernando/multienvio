/**
 * J&T Express - Server Component
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import JTClient from './JTClient';

export default async function JTPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <JTClient />
    </Suspense>
  );
}
