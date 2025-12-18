import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import { PageShell } from '@/shared/ui/PageShell';

export default function Loading() {
  return (
    <PageShell title="Pagamentos pelo Destinatario">
      <ELSkeleton active paragraph={{ rows: 6 }} />
    </PageShell>
  );
}
