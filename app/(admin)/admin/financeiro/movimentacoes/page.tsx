'use client';

import { WalletTransactionsTable } from '@/components/admin/finance/WalletTransactionsTable';
import { PageShell } from '@/components/shared/PageShell';

export default function MovimentacoesPage() {
  return (
    <PageShell title="Movimentações" gap="md">
      <WalletTransactionsTable />
    </PageShell>
  );
}
