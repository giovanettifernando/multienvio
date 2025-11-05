'use client';

import { Card, Empty } from 'antd';

export default function ColetasPage() {
  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Fila de Coletas</h1>

      <Card>
        <Empty
          description="Nenhuma coleta pendente no momento"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  );
}
