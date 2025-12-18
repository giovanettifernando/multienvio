"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Breadcrumb, Card } from "antd";
import { TicketDetailsContent } from '@/modules/support/ui/components/TicketDetailsDrawer';
import { PageShell } from '@/shared/ui/PageShell';

type RouteParams = { id: string };

export default function AdminSupportTicketClient({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  const { id: ticketId = "" } = use(params ?? Promise.resolve({ id: "" }));
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const backHref = `/admin/suporte${query ? `?${query}` : ""}`;

  return (
    <PageShell
      title="Detalhes do chamado"
      gap="md"
      extra={
        <Breadcrumb
          items={[
            {
              title: <Link href={backHref}>Suporte</Link>,
            },
            {
              title: ticketId || "Ticket",
            },
          ]}
        />
      }
    >
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <TicketDetailsContent
          ticketId={ticketId}
          userRole="admin"
          enableQuery
        />
      </Card>
    </PageShell>
  );
}
