import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import ClientWrapper from './ClientWrapper';

export const metadata = {
  title: "Pagamentos Pendentes - Envio Legal",
  description: "Gerencie as solicitacoes de pagamento enviadas para destinatarios",
};

export default async function PagamentosPendentesPage() {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ClientWrapper />
    </Suspense>
  );
}
