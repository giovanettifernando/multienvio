import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

const NovoSuporteClient = dynamic(() => import('./NovoSuporteClient'));

export default async function NovoSuportePage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <NovoSuporteClient />
    </Suspense>
  );
}
