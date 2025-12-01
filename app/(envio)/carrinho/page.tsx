import { Suspense } from 'react';
import { connection } from 'next/server';
import CarrinhoLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CarrinhoPage() {
  await connection();
  return (
    <Suspense fallback={<CarrinhoLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
