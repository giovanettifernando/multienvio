"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { use } from "react";
import { ELCard } from "@/components/ui/ELCard";
import { ELButton } from "@/components/ui/ELButton";
import { useRouter, useSearchParams } from "next/navigation";
import { TicketDetailsContent } from "@/components/support/TicketDetailsDrawer";
import { PageShell } from "@/components/shared/PageShell";

type RouteParams = { id: string };

export default function TicketDetailClient({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  const router = useRouter();
  const resolvedParams = use(params ?? Promise.resolve({ id: "" }));
  const ticketId = resolvedParams.id ?? "";
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const backHref = `/suporte${query ? `?${query}` : ""}`;

  return (
    <PageShell
      title="Detalhes do ticket"
      gap="md"
      extra={
        <ELButton
          variant="ghost"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(backHref)}
        >
          Voltar
        </ELButton>
      }
    >
      <ELCard padding="sm">
        <TicketDetailsContent ticketId={ticketId} userRole="cliente" enableQuery />
      </ELCard>
    </PageShell>
  );
}
