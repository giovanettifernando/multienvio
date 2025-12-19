/**
 * Dashboard Admin - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminDashboardPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminDashboardClient />
    </Suspense>
  );
}
