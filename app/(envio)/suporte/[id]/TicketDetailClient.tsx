"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { use } from "react";
import { Button, Card } from "antd";
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
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(backHref)}
        >
          Voltar
        </Button>
      }
    >
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <TicketDetailsContent ticketId={ticketId} userRole="cliente" enableQuery />
      </Card>
    </PageShell>
  );
}
