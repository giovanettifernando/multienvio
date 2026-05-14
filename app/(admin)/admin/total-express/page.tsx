// app/(admin)/admin/total-express/page.tsx

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import TotalExpressClient from './TotalExpressClient';

export default async function TotalExpressPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <TotalExpressClient />
    </Suspense>
  );
}
