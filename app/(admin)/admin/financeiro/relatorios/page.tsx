'use client';

import { Tabs } from 'antd';
import { DRETable } from '@/components/admin/finance/DRETable';
import { PageShell } from '@/components/shared/PageShell';

export default function RelatoriosPage() {
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
        ]}
      />
    </PageShell>
  );
}
