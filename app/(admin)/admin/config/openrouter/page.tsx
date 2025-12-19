/**
 * Config > Openrouter - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import OpenRouterClient from './OpenRouterClient';

export default async function OpenRouterPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <OpenRouterClient />
    </Suspense>
  );
}
