import { Suspense } from 'react';
import { connection } from 'next/server';
import CarteiraLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CarteiraPage() {
  await connection();
  return (
    <Suspense fallback={<CarteiraLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
