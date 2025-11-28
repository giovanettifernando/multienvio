'use client';

import { ProfileCommissionsTable } from '@/components/admin/finance/ProfileCommissionsTable';
import { PageShell } from '@/components/shared/PageShell';

export default function ComissoesPage() {
  return (
    <PageShell title="Comissões" gap="md">
      <ProfileCommissionsTable />
    </PageShell>
  );
}
