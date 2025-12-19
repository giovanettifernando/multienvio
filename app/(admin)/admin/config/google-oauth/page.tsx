/**
 * Config > Google Oauth - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import GoogleOAuthClient from './GoogleOAuthClient';

export default async function GoogleOAuthPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <GoogleOAuthClient />
    </Suspense>
  );
}
