'use client';

import { Tabs } from 'antd';
import { DRETable } from '@/components/admin/finance/DRETable';
import { AccountsPayableTable } from '@/components/admin/finance/AccountsPayableTable';
import { PageShell } from '@/components/shared/PageShell';

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
