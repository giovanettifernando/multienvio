import { Suspense } from 'react';
import { connection } from 'next/server';
import VerifyEmailLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function VerifyEmailPage() {
  await connection();
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
