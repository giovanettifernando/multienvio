// app/(admin)/admin/pagarme/page.tsx

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import { PagarmeClient } from './PagarmeClient';

export default async function PagarmePage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <PagarmeClient />
    </Suspense>
  );
}
