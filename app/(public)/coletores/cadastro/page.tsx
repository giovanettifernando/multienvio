import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const CadastroClient = dynamic(() => import('./CadastroClient'));

export default async function CadastroPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <CadastroClient />
    </Suspense>
  );
}
