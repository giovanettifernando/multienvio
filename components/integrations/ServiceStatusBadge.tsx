import { Badge, Tag } from 'antd';
import type { HealthStatus } from '@/lib/integrations/types';

interface ServiceStatusBadgeProps {
  status: HealthStatus;
  text?: string;
  showBadge?: boolean;
}

export default function ServiceStatusBadge({
  status,
  text,
  showBadge = true,
}: ServiceStatusBadgeProps) {
  const isUp = status === 'up';
  const color = isUp ? 'success' : 'error';
  const badgeStatus = isUp ? 'success' : 'error';
  const label = text || (isUp ? 'Ativa' : 'Inativa');

  if (!showBadge) {
    return <Tag color={color}>{label}</Tag>;
  }

  return (
    <Badge status={badgeStatus} text={<Tag color={color}>{label}</Tag>} />
  );
}
