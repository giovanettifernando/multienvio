'use client';

import { WalletTransactionsTable } from '@/modules/admin/ui/components/finance/WalletTransactionsTable';
import { PageShell } from '@/shared/ui/PageShell';

export default function MovimentacoesClient() {
  return (
    <PageShell title="Movimentações" gap="md">
      <WalletTransactionsTable />
    </PageShell>
  );
}
