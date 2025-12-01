import { Suspense } from 'react';
import { connection } from 'next/server';
import ForgotPasswordLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ForgotPasswordPage() {
  await connection();
  return (
    <Suspense fallback={<ForgotPasswordLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
