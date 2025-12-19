import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

export const metadata = {
  title: "Pagamentos Pendentes - Envio Legal",
  description: "Gerencie as solicitacoes de pagamento enviadas para destinatarios",
};

const RecipientPaymentsClient = dynamic(() => import('./RecipientPaymentsClient'));

export default async function PagamentosPendentesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <RecipientPaymentsClient />
    </Suspense>
  );
}
