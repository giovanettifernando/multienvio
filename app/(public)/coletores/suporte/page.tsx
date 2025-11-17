'use client';

import { Card, Empty } from 'antd';
import { PageShell } from '@/components/shared/PageShell';

export default function SuportePage() {
  return (
    <PageShell title="Suporte" gap="md">
      <Card>
        <Empty
          description="Sistema de suporte em desenvolvimento"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </PageShell>
  );
}
