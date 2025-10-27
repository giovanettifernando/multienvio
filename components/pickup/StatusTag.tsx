import { Tag } from 'antd';
import type { StatusOperacional } from '@/lib/pickup/types';

interface StatusTagProps {
  status: StatusOperacional;
}

export default function StatusTag({ status }: StatusTagProps) {
  return (
    <Tag color={status === 'active' ? 'success' : 'error'}>
      {status === 'active' ? 'Ativo' : 'Bloqueado'}
    </Tag>
  );
}
