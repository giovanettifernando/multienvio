import { Suspense } from 'react';
import { connection } from 'next/server';
import ConfirmacaoLoading from './loading';
import dynamic from 'next/dynamic';

const ConfirmacaoClient = dynamic(() => import('./ConfirmacaoClient'));

export default async function ConfirmacaoPage() {
  await connection();
  return (
    <Suspense fallback={<ConfirmacaoLoading />}>
      <ConfirmacaoClient />
    </Suspense>
  );
}
