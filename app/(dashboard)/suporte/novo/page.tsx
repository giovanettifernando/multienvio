"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { TicketForm } from "@/components/support/TicketForm";
import type { Ticket } from "@/types/support";

export default function NewTicketPage() {
  const router = useRouter();

  const handleCreated = (ticket: Ticket) => {
    router.push(`/suporte/${ticket.id}`);
  };

  return (
    <Space direction="vertical" style={{ width: "100%", padding: 24 }} size={24}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.back()}
        style={{ padding: 0, width: "fit-content" }}
      >
        Voltar
      </Button>

      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Abrir novo ticket
        </Typography.Title>
        <Typography.Text type="secondary">
          Informe os detalhes do problema para que nossa equipe possa ajudar rapidamente.
        </Typography.Text>
      </Space>

      <TicketForm onCreated={handleCreated} />
    </Space>
  );
}
