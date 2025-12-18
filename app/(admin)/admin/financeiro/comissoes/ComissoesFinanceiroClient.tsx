'use client';

import { ProfileCommissionsTable } from '@/modules/admin/ui/components/finance/ProfileCommissionsTable';
import { PageShell } from '@/shared/ui/PageShell';

export default function ComissoesFinanceiroClient() {
  return (
    <PageShell title="Comissões" gap="md">
      <ProfileCommissionsTable />
    </PageShell>
  );
}
