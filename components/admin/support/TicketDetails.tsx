"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import {
  App,
  Card,
  Empty,
  Flex,
  Result,
  Skeleton,
  Space,
  Timeline,
  Typography,
} from "antd";
import { FlagOutlined, IdcardOutlined, MessageOutlined, PlusCircleOutlined } from "@ant-design/icons";
import type { SupportTicket, TicketCategory, TicketStatus } from "@/lib/support/types";
import { useTicket, useUpdateTicket } from "@/lib/support/hooks";
import { adminMockUsers } from "@/lib/admin/mock-users";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/support/utils";
import { TicketHeader } from "./TicketHeader";
import { ReplyBox } from "./ReplyBox";

interface TicketDetailsProps {
  ticketId?: string | null;
  viewerId?: string;
  headingId?: string;
}

type TimelineEvent = SupportTicket["timeline"][number];

function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function formatDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

function getTimelineMeta(event: TimelineEvent) {
  switch (event.type) {
    case "comment":
      return {
        title: event.author === "cliente" ? "Mensagem do cliente" : "Resposta do suporte",
        color: event.author === "cliente" ? "blue" : "green",
        icon: <MessageOutlined />,
      };
    case "status":
      return {
        title: "Atualização de status",
        color: "purple",
        icon: <FlagOutlined />,
      };
    case "assign":
      return {
        title: "Atribuição",
        color: "orange",
        icon: <IdcardOutlined />,
      };
    case "created":
    default:
      return {
        title: "Ticket criado",
        color: "gray",
        icon: <PlusCircleOutlined />,
      };
  }
}

export function TicketDetails({ ticketId, viewerId, headingId }: TicketDetailsProps) {
  const { message } = App.useApp();
  const updateMutation = useUpdateTicket();
  const ticketQuery = useTicket(ticketId ?? undefined);

  const assignOptions = useMemo(() => adminMockUsers, []);

  const statusOptions = useMemo(
    () =>
      (Object.entries(TICKET_STATUS_LABEL) as Array<[TicketStatus, string]>).map(
        ([value, label]) => ({
          value,
          label,
        }),
      ),
    [],
  );

  const categoryOptions = useMemo(
    () =>
      (Object.entries(TICKET_CATEGORY_LABEL) as Array<[TicketCategory, string]>).map(
        ([value, label]) => ({
          value,
          label,
        }),
      ),
    [],
  );

  const handleStatusChange = (status: TicketStatus) => {
    if (!ticketId || !ticketQuery.data) return;
    if (status === ticketQuery.data.status) return;
    updateMutation.mutate(
      { id: ticketId, data: { status } },
      {
        onSuccess: () => {
          message.success("Status atualizado.");
        },
        onError: (error) => {
          const text =
            error instanceof Error ? error.message : "Não foi possível atualizar o status.";
          message.error(text);
        },
      },
    );
  };

  const handleCategoryChange = (category: TicketCategory) => {
    if (!ticketId || !ticketQuery.data) return;
    if (category === ticketQuery.data.category) return;
    updateMutation.mutate(
      { id: ticketId, data: { category } },
      {
        onSuccess: () => {
          message.success("Categoria atualizada.");
        },
        onError: (error) => {
          const text =
            error instanceof Error ? error.message : "Não foi possível atualizar a categoria.";
          message.error(text);
        },
      },
    );
  };

  const handleAssigneeChange = (assigneeUserId: string | null) => {
    if (!ticketId || !ticketQuery.data) return;
    if (assigneeUserId === ticketQuery.data.assigneeUserId) return;
    updateMutation.mutate(
      { id: ticketId, data: { assigneeUserId } },
      {
        onSuccess: () => {
          message.success("Responsável atualizado.");
        },
        onError: (error) => {
          const text =
            error instanceof Error ? error.message : "Não foi possível atualizar o responsável.";
          message.error(text);
        },
      },
    );
  };

  const handleAssignToMe = () => {
    if (!viewerId || !ticketId || !ticketQuery.data) return;
    if (ticketQuery.data.assigneeUserId === viewerId) return;
    updateMutation.mutate(
      { id: ticketId, data: { assigneeUserId: viewerId } },
      {
        onSuccess: () => {
          message.success("Ticket atribuído a você.");
        },
        onError: (error) => {
          const text =
            error instanceof Error ? error.message : "Não foi possível atribuir o ticket.";
          message.error(text);
        },
      },
    );
  };

  if (!ticketId) {
    return (
      <Card size="small">
        <Empty description="Selecione um ticket para visualizar os detalhes." />
      </Card>
    );
  }

  if (ticketQuery.isLoading) {
    return <TicketDetailsSkeleton />;
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar o ticket"
        subTitle={
          ticketQuery.error instanceof Error
            ? ticketQuery.error.message
            : "Tente novamente mais tarde."
        }
        extra={
          <Typography.Link onClick={() => ticketQuery.refetch()}>
            Tentar novamente
          </Typography.Link>
        }
      />
    );
  }

  const ticket = ticketQuery.data;
  const timeline = sortTimeline(ticket.timeline);
  const headerId = headingId ?? `ticket-${ticket.id}`;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <TicketHeader
        ticket={ticket}
        viewerId={viewerId}
        assignOptions={assignOptions}
        statusOptions={statusOptions}
        categoryOptions={categoryOptions}
        isUpdating={updateMutation.isPending}
        headingId={headerId}
        onChangeStatus={handleStatusChange}
        onChangeCategory={handleCategoryChange}
        onChangeAssignee={handleAssigneeChange}
        onAssignToMe={handleAssignToMe}
      />

      <Card size="small" title="Resumo do ticket">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {ticket.title}
          </Typography.Title>
          <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {ticket.description}
          </Typography.Paragraph>
        </Space>
      </Card>

      <Flex align="start" gap={16} wrap>
        <Card
          size="small"
          title="Linha do tempo"
          style={{ flex: 1, minWidth: 320 }}
        >
          {timeline.length === 0 ? (
            <Empty description="Nenhum evento registrado." />
          ) : (
            <Timeline
              items={timeline.map((event) => {
                const meta = getTimelineMeta(event);
                return {
                  key: event.id,
                  color: meta.color,
                  dot: meta.icon,
                  children: (
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Typography.Text strong>{meta.title}</Typography.Text>
                      {event.message && (
                        <Typography.Paragraph style={{ margin: 0 }}>
                          {event.message}
                        </Typography.Paragraph>
                      )}
                      <Typography.Text type="secondary">
                        {formatDate(event.at)} ·{" "}
                        {event.author === "cliente" ? "Cliente" : "Suporte"}
                      </Typography.Text>
                    </Space>
                  ),
                };
              })}
            />
          )}
        </Card>

        <Space direction="vertical" size={16} style={{ width: 280, minWidth: 240 }}>
          <Card size="small" title="Solicitante">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{ticket.requester.name}</Typography.Text>
              {ticket.requester.email && (
                <Typography.Text type="secondary">{ticket.requester.email}</Typography.Text>
              )}
              {ticket.requester.phone && (
                <Typography.Text type="secondary">{ticket.requester.phone}</Typography.Text>
              )}
            </Space>
          </Card>
          <Card size="small" title="Vínculos">
            {ticket.linkedTrackingCode ? (
              <Typography.Link
                href={`/admin/operacoes?tracking=${ticket.linkedTrackingCode}`}
              >
                {ticket.linkedTrackingCode}
              </Typography.Link>
            ) : (
              <Typography.Text>—</Typography.Text>
            )}
          </Card>
        </Space>
      </Flex>

      <ReplyBox ticketId={ticket.id} />
    </Space>
  );
}

function TicketDetailsSkeleton() {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card size="small">
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
      <Card size="small" title="Resumo do ticket">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
      <Flex align="start" gap={16} wrap>
        <Card size="small" style={{ flex: 1, minWidth: 320 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
        <Space direction="vertical" size={16} style={{ width: 280, minWidth: 240 }}>
          <Card size="small">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Card size="small">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Space>
      </Flex>
      <Card size="small">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    </Space>
  );
}
