import { Suspense } from 'react';
import { connection } from 'next/server';
import CadastroLoading from './loading';
import ClientWrapper from './ClientWrapper';

export default async function CadastroPage() {
  await connection();
  return (
    <Suspense fallback={<CadastroLoading />}>
      <ClientWrapper />
    </Suspense>
  );
}
