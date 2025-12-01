import { Suspense } from 'react';
import { connection } from 'next/server';
import ResetPasswordLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ResetPasswordPage() {
  await connection();
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
