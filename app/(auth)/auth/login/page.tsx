import { Suspense } from 'react';
import { connection } from 'next/server';
import LoginLoading from './loading';
import dynamic from 'next/dynamic';

const LoginClient = dynamic(() => import('./LoginClient'));

export default async function LoginPage() {
  await connection();
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginClient />
    </Suspense>
  );
}
