"use client";

import dayjs from "dayjs";
import { Button, Card, Flex, Select, Space, Tag, Typography } from "antd";
import {
  ClockCircleOutlined,
  CustomerServiceOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import type { AdminMockUser } from "@/lib/admin/mock-users";
import type { SupportTicket, TicketCategory, TicketStatus } from "@/lib/support/types";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_COLOR,
  TICKET_STATUS_LABEL,
} from "@/lib/support/utils";

interface TicketHeaderProps {
  ticket: SupportTicket;
  assignOptions: AdminMockUser[];
  statusOptions: Array<{ label: string; value: TicketStatus }>;
  categoryOptions: Array<{ label: string; value: TicketCategory }>;
  isUpdating?: boolean;
  viewerId?: string;
  headingId?: string;
  onChangeStatus(status: TicketStatus): void;
  onChangeCategory(category: TicketCategory): void;
  onChangeAssignee(assigneeUserId: string | null): void;
  onAssignToMe(): void;
}

function formatSla(date?: string | null) {
  if (!date) return null;
  const formatted = dayjs(date).format("DD/MM/YYYY HH:mm");
  const overdue = dayjs(date).isBefore(dayjs());
  return { formatted, overdue };
}

export function TicketHeader({
  ticket,
  assignOptions,
  categoryOptions,
  statusOptions,
  isUpdating,
  viewerId,
  headingId,
  onChangeStatus,
  onChangeCategory,
  onChangeAssignee,
  onAssignToMe,
}: TicketHeaderProps) {
  const slaInfo = formatSla(ticket.slaDueAt);
  const isAssignedToViewer = viewerId && ticket.assigneeUserId === viewerId;
  const titleId = headingId ?? `ticket-${ticket.id}`;

  return (
    <Card
      size="small"
      styles={{ body: { display: "flex", flexDirection: "column", gap: 16 } }}
    >
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Space size={8} wrap>
          <Typography.Title
            id={titleId}
            level={3}
            style={{ margin: 0 }}
            tabIndex={-1}
          >
            {ticket.id}
          </Typography.Title>
          <Tag color={TICKET_STATUS_COLOR[ticket.status]} style={{ borderRadius: 999 }}>
            {TICKET_STATUS_LABEL[ticket.status]}
          </Tag>
          <Tag icon={<CustomerServiceOutlined />} style={{ borderRadius: 999 }}>
            {TICKET_CATEGORY_LABEL[ticket.category]}
          </Tag>
        </Space>
        {slaInfo ? (
          <Tag
            icon={<ClockCircleOutlined />}
            color={slaInfo.overdue ? "red" : "blue"}
            style={{ borderRadius: 999 }}
          >
            SLA até {slaInfo.formatted}
          </Tag>
        ) : (
          <Tag icon={<ClockCircleOutlined />} style={{ borderRadius: 999 }}>
            Sem SLA
          </Tag>
        )}
      </Flex>

      <Typography.Text type="secondary">
        Aberto em {dayjs(ticket.createdAt).format("DD/MM/YYYY HH:mm")} · Atualizado em{" "}
        {dayjs(ticket.updatedAt).format("DD/MM/YYYY HH:mm")}
      </Typography.Text>

      <Flex gap={12} wrap>
        <Select<TicketStatus>
          value={ticket.status}
          style={{ minWidth: 160 }}
          options={statusOptions}
          onChange={onChangeStatus}
          disabled={isUpdating}
        />
        <Select<TicketCategory>
          value={ticket.category}
          style={{ minWidth: 160 }}
          options={categoryOptions}
          onChange={onChangeCategory}
          disabled={isUpdating}
        />
        <Select<string>
          allowClear
          placeholder="Responsável"
          value={ticket.assigneeUserId ?? undefined}
          options={assignOptions.map((user) => ({
            label: user.name,
            value: user.id,
          }))}
          style={{ minWidth: 200 }}
          onChange={(value) => onChangeAssignee(value ?? null)}
          disabled={isUpdating}
          suffixIcon={<IdcardOutlined />}
        />
        <Button
          onClick={onAssignToMe}
          disabled={!viewerId || isAssignedToViewer || isUpdating}
        >
          Atribuir a mim
        </Button>
      </Flex>
    </Card>
  );
}
