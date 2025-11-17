'use client';

import { Card, Empty } from 'antd';
import { PageShell } from '@/components/shared/PageShell';

export default function ColetasPage() {
  return (
    <PageShell title="Fila de Coletas" gap="md">
      <Card>
        <Empty
          description="Nenhuma coleta pendente no momento"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </PageShell>
  );
}
