"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { use } from "react";
import { Button, Card, Space, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { TicketDetailsContent } from "@/components/support/TicketDetailsDrawer";

type RouteParams = { id: string };

export default function SupportTicketDetailPage({
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
    <Space direction="vertical" style={{ width: "100%", padding: 24 }} size={24}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push(backHref)}
        style={{ padding: 0, width: "fit-content" }}
      >
        Voltar
      </Button>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Detalhes do ticket
      </Typography.Title>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <TicketDetailsContent ticketId={ticketId} userRole="cliente" enableQuery />
      </Card>
    </Space>
  );
}
