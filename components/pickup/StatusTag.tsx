import { Tag } from 'antd';
import type { StatusOperacional } from '@/lib/pickup/types';

interface StatusTagProps {
  status: StatusOperacional;
}

export default function StatusTag({ status }: StatusTagProps) {
  return (
    <Tag color={String(status) === 'ACTIVE' ? 'success' : 'error'}>
      {String(status) === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}
    </Tag>
  );
}
