import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const NovoSupportClient = dynamic(() => import('./NovoSupportClient'));

export default async function NovoSupportPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <NovoSupportClient />
    </Suspense>
  );
}
