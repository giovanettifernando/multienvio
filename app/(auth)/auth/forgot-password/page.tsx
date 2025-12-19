import { Suspense } from 'react';
import { connection } from 'next/server';
import ForgotPasswordLoading from './loading';
import dynamic from 'next/dynamic';

const ForgotPasswordClient = dynamic(() => import('./ForgotPasswordClient'));

export default async function ForgotPasswordPage() {
  await connection();
  return (
    <Suspense fallback={<ForgotPasswordLoading />}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
