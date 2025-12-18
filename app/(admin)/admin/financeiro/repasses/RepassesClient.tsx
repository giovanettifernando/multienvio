'use client';

import { CarrierPayoutsTable } from '@/modules/admin/ui/components/finance/CarrierPayoutsTable';
import { PageShell } from '@/shared/ui/PageShell';

export default function RepassesClient() {
  return (
    <PageShell title="Repasses às Transportadoras" gap="md">
      <CarrierPayoutsTable />
    </PageShell>
  );
}
