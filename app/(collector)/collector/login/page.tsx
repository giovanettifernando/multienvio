import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const LoginCollectorClient = dynamic(() => import('./LoginCollectorClient'));

export default async function LoginCollectorPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <LoginCollectorClient />
    </Suspense>
  );
}
