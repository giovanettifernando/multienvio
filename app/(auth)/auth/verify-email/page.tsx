import { Suspense } from 'react';
import { connection } from 'next/server';
import VerifyEmailLoading from './loading';
import dynamic from 'next/dynamic';

const VerifyEmailClient = dynamic(() => import('./VerifyEmailClient'));

export default async function VerifyEmailPage() {
  await connection();
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
