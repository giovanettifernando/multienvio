import { Suspense } from 'react';
import { connection } from 'next/server';
import LayoutWrapper from './LayoutWrapper';
import { LayoutLoader } from '@/shared/ui/LayoutLoader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <Suspense fallback={<LayoutLoader />}>
      <LayoutWrapper>{children}</LayoutWrapper>
    </Suspense>
  );
}
