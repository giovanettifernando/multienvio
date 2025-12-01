import { Suspense } from 'react';
import { connection } from 'next/server';
import Loading from './loading';
import ClientWrapper from './ClientWrapper';

type RouteParams = { id: string };

export default async function TicketDetailPage({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <ClientWrapper params={params} />
    </Suspense>
  );
}
