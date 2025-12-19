/**
 * Config - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminConfigClient from './AdminConfigClient';

export default async function AdminConfigPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminConfigClient />
    </Suspense>
  );
}
