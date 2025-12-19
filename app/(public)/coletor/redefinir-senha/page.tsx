import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import dynamic from 'next/dynamic';

const RedefinirSenhaClient = dynamic(() => import('./RedefinirSenhaClient'));

export default async function RedefinirSenhaPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RedefinirSenhaClient />
    </Suspense>
  );
}
