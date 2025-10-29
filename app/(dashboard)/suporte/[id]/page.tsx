"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Flex,
  Result,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { TicketDetailHeader } from "@/components/support/TicketDetailHeader";
import { TicketTimeline } from "@/components/support/TicketTimeline";
import { TicketCommentBox } from "@/components/support/TicketCommentBox";
import { RelatedEntities } from "@/components/support/RelatedEntities";
import type { SupportAttachment, Ticket } from "@/types/support";

type HttpError = Error & { status?: number };

async function fetchTicket(ticketId: string): Promise<Ticket> {
  const response = await fetch(`/api/support/tickets/${ticketId}`);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const error: HttpError = new Error(
      body?.mensagem ?? "Não foi possível carregar o ticket",
    );
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as Ticket;
}

async function fetchAttachments(ticketId: string): Promise<SupportAttachment[]> {
  const response = await fetch(`/api/support/tickets/${ticketId}/attachments`);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const error: HttpError = new Error(
      body?.mensagem ?? "Não foi possível carregar os anexos",
    );
    error.status = response.status;
    throw error;
  }
  const data = (await response.json()) as { attachments: SupportAttachment[] };
  return data.attachments ?? [];
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ticketId = params?.id ?? "";

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => fetchTicket(ticketId),
    enabled: Boolean(ticketId),
    retry: false,
  });

  const attachmentsQuery = useQuery({
    queryKey: ["ticket", ticketId, "attachments"],
    queryFn: () => fetchAttachments(ticketId),
    enabled: Boolean(ticketId) && ticketQuery.status === "success",
  });

  const ticket = ticketQuery.data;
  const attachments = attachmentsQuery.data ?? [];

  const renderContent = () => {
    if (ticketQuery.isLoading) {
      return (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card variant="borderless">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Flex gap={24} wrap>
            <Card variant="borderless" style={{ flex: 1, minWidth: 320 }}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
            <Card variant="borderless" style={{ width: 360, minWidth: 280 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </Flex>
        </Space>
      );
    }

    if (ticketQuery.isError || !ticket) {
      const error = ticketQuery.error as HttpError | undefined;
      const isNotFound = error?.status === 404;
      return (
        <Result
          status={isNotFound ? "404" : "error"}
          title={isNotFound ? "Ticket não encontrado" : "Ops, algo deu errado"}
          subTitle={
            isNotFound
              ? "Verifique se o ticket ainda existe ou se o identificador está correto."
              : error?.message ?? "Tente novamente mais tarde."
          }
          extra={[
            <Button key="retry" type="primary" onClick={() => ticketQuery.refetch()}>
              Tentar novamente
            </Button>,
            <Button key="back" onClick={() => router.push("/suporte?status=OPEN")}>
              Voltar para lista
            </Button>,
          ]}
        />
      );
    }

    return (
      <Flex align="start" gap={24} wrap style={{ width: "100%" }}>
        <Space direction="vertical" size={16} style={{ flex: 1, minWidth: 320 }}>
          <TicketDetailHeader
            ticket={ticket}
            mode="client"
          />
          <Card
            variant="borderless"
            title="Linha do tempo"
            styles={{ body: { paddingTop: 0 } }}
          >
            <TicketTimeline
              events={ticket.events}
              attachments={attachments}
            />
          </Card>
        </Space>

        <Space direction="vertical" size={16} style={{ width: 360, minWidth: 280 }}>
          <Card variant="borderless" title="Responder/complementar chamado">
            <TicketCommentBox ticketId={ticket.id} mode="client" />
          </Card>
          <RelatedEntities related={ticket.related} />
        </Space>
      </Flex>
    );
  };

  return (
    <Space direction="vertical" style={{ width: "100%", padding: 24 }} size={24}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/suporte?status=OPEN")}
        style={{ padding: 0, width: "fit-content" }}
      >
        Voltar
      </Button>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Detalhes do ticket
      </Typography.Title>
      {renderContent()}
    </Space>
  );
}
