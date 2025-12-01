'use client';

import { CarrierPayoutsTable } from '@/components/admin/finance/CarrierPayoutsTable';
import { PageShell } from '@/components/shared/PageShell';

export default function RepassesClient() {
  return (
    <PageShell title="Repasses às Transportadoras" gap="md">
      <CarrierPayoutsTable />
    </PageShell>
  );
}
