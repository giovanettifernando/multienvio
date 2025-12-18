'use client';

import { ExpensesTable } from '@/modules/admin/ui/components/finance/ExpensesTable';
import { PageShell } from '@/shared/ui/PageShell';

export default function DespesasClient() {
  return (
    <PageShell title="Despesas" gap="md">
      <ExpensesTable />
    </PageShell>
  );
}
