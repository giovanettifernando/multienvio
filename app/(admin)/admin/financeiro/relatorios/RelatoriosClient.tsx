'use client';

import { ELTabs } from '@/shared/ui';
import { DRETable } from '@/modules/admin/ui/components/finance/DRETable';
import { AccountsPayableTable } from '@/modules/admin/ui/components/finance/AccountsPayableTable';
import { PageShell } from '@/shared/ui/PageShell';

const Tabs = ELTabs;

export default function RelatoriosClient() {
  return (
    <PageShell title="Relatórios Financeiros" gap="md">
      <Tabs
        defaultActiveKey="dre"
        items={[
          {
            key: 'dre',
            label: 'DRE',
            children: <DRETable />,
          },
          {
            key: 'accounts-payable',
            label: 'Contas a Pagar',
            children: <AccountsPayableTable />,
          },
        ]}
      />
    </PageShell>
  );
}
