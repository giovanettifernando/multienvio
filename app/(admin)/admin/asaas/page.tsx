// app/(admin)/admin/asaas/page.tsx

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import { AsaasClient } from './AsaasClient';

export default async function AsaasPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AsaasClient />
    </Suspense>
  );
}
