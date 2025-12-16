import { ELSkeleton } from "@/components/ui/ELSkeleton";
import { PageShell } from "@/components/shared/PageShell";

export default function Loading() {
  return (
    <PageShell title="Pagamentos pelo Destinatario">
      <ELSkeleton active paragraph={{ rows: 6 }} />
    </PageShell>
  );
}
