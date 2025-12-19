import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import CarteiraLoading from './loading';

const CarteiraClient = dynamic(() => import('./CarteiraClient'));

export default async function CarteiraPage() {
  await connection();
  return (
    <Suspense fallback={<CarteiraLoading />}>
      <CarteiraClient />
    </Suspense>
  );
}
