import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const LoginColetorClient = dynamic(() => import('./LoginColetorClient'));

export default async function LoginColetorPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <LoginColetorClient />
    </Suspense>
  );
}
