'use client';

import { ProfileCommissionsTable } from '@/components/admin/finance/ProfileCommissionsTable';
import { PageShell } from '@/components/shared/PageShell';

export default function ComissoesFinanceiroClient() {
  return (
    <PageShell title="Comissões" gap="md">
      <ProfileCommissionsTable />
    </PageShell>
  );
}
