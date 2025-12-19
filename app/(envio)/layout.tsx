import { Suspense } from 'react';
import { connection } from 'next/server';
import dynamic from 'next/dynamic';
import { LayoutLoader } from '@/shared/ui/LayoutLoader';

const EnvioLayoutClient = dynamic(() => import('./EnvioLayoutClient'));

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <Suspense fallback={<LayoutLoader />}>
      <EnvioLayoutClient>{children}</EnvioLayoutClient>
    </Suspense>
  );
}
