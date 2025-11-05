'use client';

import { Card, Empty } from 'antd';

export default function SuportePage() {
  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Suporte</h1>

      <Card>
        <Empty
          description="Sistema de suporte em desenvolvimento"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  );
}
