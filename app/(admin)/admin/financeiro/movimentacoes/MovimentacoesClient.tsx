'use client';

import { WalletTransactionsTable } from '@/components/admin/finance/WalletTransactionsTable';
import { PageShell } from '@/components/shared/PageShell';

export default function MovimentacoesClient() {
  return (
    <PageShell title="Movimentações" gap="md">
      <WalletTransactionsTable />
    </PageShell>
  );
}
