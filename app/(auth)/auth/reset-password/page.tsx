import { Suspense } from 'react';
import { connection } from 'next/server';
import ResetPasswordLoading from './loading';
import dynamic from 'next/dynamic';

const ResetPasswordClient = dynamic(() => import('./ResetPasswordClient'));

export default async function ResetPasswordPage() {
  await connection();
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
