import { Suspense } from 'react';
import { connection } from 'next/server';
import ConfirmacaoLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function ConfirmacaoPage() {
  await connection();
  return (
    <Suspense fallback={<ConfirmacaoLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
