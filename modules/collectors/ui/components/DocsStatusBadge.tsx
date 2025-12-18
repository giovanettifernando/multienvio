'use client';

import { Tooltip, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Collector } from '@/modules/collectors/application/types';

interface DocsStatusBadgeProps {
  collector: Collector;
}

export default function DocsStatusBadge({ collector }: DocsStatusBadgeProps) {
  const missing: string[] = [];

  if (!collector.documents.cnhFiles || collector.documents.cnhFiles.length === 0) {
    missing.push('CNH');
  }

  if (!collector.documents.crlvFile || collector.documents.crlvFile.length === 0) {
    missing.push('CRLV');
  }

  if (!collector.documents.pfAddressProofFile || collector.documents.pfAddressProofFile.length === 0) {
    missing.push('Comprovante de endereço');
  }

  const ok = missing.length === 0;
  const tooltip = ok ? 'Todos os documentos obrigatórios enviados' : `Faltando: ${missing.join(', ')}`;

  return (
    <Tooltip title={tooltip}>
      <Tag
        color={ok ? 'green' : 'red'}
        icon={ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        style={{ marginRight: 0 }}
      >
        {ok ? 'OK' : 'Pendentes'}
      </Tag>
    </Tooltip>
  );
}
