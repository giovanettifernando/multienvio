"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Breadcrumb, Space, Typography } from "antd";
import { useAdminSession } from "@/stores/useAdminSession";
import { TicketDetails } from "@/components/admin/support/TicketDetails";

type RouteParams = { id: string };

export default function AdminSupportTicketPage({
  params,
}: {
  params?: Promise<RouteParams>;
}) {
  const { id: ticketId = "" } = use(params ?? Promise.resolve({ id: "" }));
  const searchParams = useSearchParams();
  const admin = useAdminSession((state) => state.admin);
  const viewerId = admin?.id;
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
      <TicketDetails
        ticketId={ticketId}
        viewerId={viewerId}
        headingId={ticketId ? `ticket-page-${ticketId}` : undefined}
      />
    </Space>
  );
}
