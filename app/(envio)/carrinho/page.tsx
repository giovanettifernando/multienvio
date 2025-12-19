import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import CarrinhoLoading from './loading';

const CarrinhoClient = dynamic(() => import('./CarrinhoClient'));

export default async function CarrinhoPage() {
  await connection();
  return (
    <Suspense fallback={<CarrinhoLoading />}>
      <CarrinhoClient />
    </Suspense>
  );
}
