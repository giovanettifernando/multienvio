import { Suspense } from 'react';
import { connection } from 'next/server';
import ResetTokenLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ResetTokenPage() {
  await connection();
  return (
    <Suspense fallback={<ResetTokenLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
