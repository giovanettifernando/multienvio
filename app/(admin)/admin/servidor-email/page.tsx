/**
 * Servidor Email - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import EmailServerClient from './EmailServerClient';

export default async function EmailServerPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <EmailServerClient />
    </Suspense>
  );
}
