import { Suspense } from 'react';
import { connection } from 'next/server';
import LoginLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function LoginPage() {
  await connection();
  return (
    <Suspense fallback={<LoginLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
