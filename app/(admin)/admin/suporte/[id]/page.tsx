"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Breadcrumb, Space, Typography, Card } from "antd";
import { TicketDetailsContent } from "@/components/support/TicketDetailsDrawer";

type RouteParams = { id: string };

export default function AdminSupportTicketPage({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  const { id: ticketId = "" } = use(params ?? Promise.resolve({ id: "" }));
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const backHref = `/admin/suporte${query ? `?${query}` : ""}`;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
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
      <Typography.Title level={2} style={{ margin: 0 }}>
        Detalhes do chamado
      </Typography.Title>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <TicketDetailsContent
          ticketId={ticketId}
          userRole="admin"
          enableQuery
        />
      </Card>
    </Space>
  );
}
