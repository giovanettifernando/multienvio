'use client';

import { ExpensesTable } from '@/components/admin/finance/ExpensesTable';
import { PageShell } from '@/components/shared/PageShell';

export default function DespesasPage() {
  return (
    <PageShell title="Despesas" gap="md">
      <ExpensesTable />
    </PageShell>
  );
}
