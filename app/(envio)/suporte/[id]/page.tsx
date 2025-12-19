import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import Loading from './loading';

type RouteParams = { id: string };

const TicketDetailClient = dynamic(() => import('./TicketDetailClient'));

export default async function TicketDetailPage({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  await connection();
  return (
    <Suspense fallback={<Loading />}>
      <TicketDetailClient params={params} />
    </Suspense>
  );
}
