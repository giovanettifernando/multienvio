/**
 * Gateway Pagamento - Server Component
 *
 * Como o layout admin já é "use client", não precisamos de ClientWrapper.
 * Importamos o componente client diretamente.
 */

import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import PaymentGatewayClient from './PaymentGatewayClient';

export default async function PaymentGatewayPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <PaymentGatewayClient />
    </Suspense>
  );
}
