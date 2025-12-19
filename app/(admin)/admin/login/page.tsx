/**
 * Login - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminLoginClient from './AdminLoginClient';

export default async function AdminLoginPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminLoginClient />
    </Suspense>
  );
}
