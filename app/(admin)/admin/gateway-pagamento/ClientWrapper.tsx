'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const PaymentGatewayClient = dynamic(() => import('./PaymentGatewayClient'), {
  ssr: false,
});

export default function ClientWrapper() {
  return (
    <Suspense fallback={null}>
      <PaymentGatewayClient />
    </Suspense>
  );
}
