/**
 * Suporte > [Id] - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import AdminSupportTicketClient from './AdminSupportTicketClient';

export default async function AdminSupportTicketPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <AdminSupportTicketClient />
    </Suspense>
  );
}
