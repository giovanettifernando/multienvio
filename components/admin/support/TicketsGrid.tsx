"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Space,
  Table,
  Tooltip,
  Typography,
  type TablePaginationConfig,
  type TableProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TicketFiltersValue } from "./TicketFilters";
import { TicketFilters } from "./TicketFilters";
import { useTickets } from "@/lib/support/hooks";
import type { SupportTicket } from "@/lib/support/types";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL } from "@/lib/support/utils";
import { adminMockUsers } from "@/lib/admin/mock-users";

interface TicketsGridProps {
  filters: TicketFiltersValue;
  pagination: {
    page: number;
    pageSize: number;
  };
  viewerId?: string;
  onFiltersChange: (filters: TicketFiltersValue) => void;
  onPaginationChange: (page: number, pageSize: number) => void;
  onTicketSelect: (ticketId: string) => void;
}

function resolveSlaBadge(slaDueAt?: string | null) {
  if (!slaDueAt) {
    return {
      status: "default" as const,
      text: "Sem SLA",
    };
  }

  const due = dayjs(slaDueAt);
  const now = dayjs();
  const diffHours = due.diff(now, "hour", true);

  if (due.isBefore(now)) {
    return {
      status: "error" as const,
      text: `Vencido ${due.format("DD/MM HH:mm")}`,
    };
  }

  if (diffHours <= 4) {
    return {
      status: "warning" as const,
      text: `Vence ${due.format("DD/MM HH:mm")}`,
    };
  }

  return {
    status: "success" as const,
    text: `Até ${due.format("DD/MM HH:mm")}`,
  };
}

export function TicketsGrid({
  filters,
  pagination,
  viewerId,
  onFiltersChange,
  onPaginationChange,
  onTicketSelect,
}: TicketsGridProps) {
  const effectiveFilters = useMemo(() => {
    const next = { ...filters };
    if (next.assignee === "me" && !viewerId) {
      next.assignee = "all";
    }
    return next;
  }, [filters, viewerId]);

  const { data, isFetching } = useTickets({
    ...effectiveFilters,
    page: pagination.page,
    pageSize: pagination.pageSize,
    viewerId: effectiveFilters.assignee === "me" ? viewerId : undefined,
  });

  const assigneeMap = useMemo(
    () => new Map(adminMockUsers.map((user) => [user.id, user.name])),
    [],
  );

  const columns = useMemo<ColumnsType<SupportTicket>>(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        render: (value: string, record) => (
          <Typography.Link
            ellipsis
            onClick={(event) => {
              event.preventDefault();
              onTicketSelect(record.id);
            }}
          >
            {value}
          </Typography.Link>
        ),
        width: 160,
      },
      {
        title: "Título",
        dataIndex: "title",
        key: "title",
        ellipsis: { showTitle: false },
        render: (value: string) => (
          <Tooltip title={value} placement="topLeft">
            <span>{value}</span>
          </Tooltip>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status: SupportTicket["status"]) => (
          <Typography.Text>
            <Badge color={TICKET_STATUS_COLOR[status]} text={TICKET_STATUS_LABEL[status]} />
          </Typography.Text>
        ),
      },
      {
        title: "Categoria",
        dataIndex: "category",
        key: "category",
        width: 150,
        render: (category: SupportTicket["category"]) => (
          <Typography.Text>{TICKET_CATEGORY_LABEL[category]}</Typography.Text>
        ),
      },
      {
        title: "Vínculo",
        dataIndex: "linkedTrackingCode",
        key: "linkedTrackingCode",
        width: 160,
        render: (linkedTrackingCode?: string | null) =>
          linkedTrackingCode ? (
            <Typography.Link href={`/admin/operacoes?tracking=${linkedTrackingCode}`}>
              {linkedTrackingCode}
            </Typography.Link>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          ),
      },
      {
        title: "SLA",
        dataIndex: "slaDueAt",
        key: "slaDueAt",
        width: 180,
        render: (slaDueAt?: string | null) => {
          const badge = resolveSlaBadge(slaDueAt);
          return <Badge status={badge.status} text={badge.text} />;
        },
      },
      {
        title: "Atualizado em",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 180,
        defaultSortOrder: "descend",
        sorter: true,
        render: (updatedAt: string) => dayjs(updatedAt).format("DD/MM HH:mm"),
      },
      {
        title: "Responsável",
        dataIndex: "assigneeUserId",
        key: "assigneeUserId",
        width: 180,
        render: (assigneeUserId?: string | null) =>
          assigneeUserId ? (
            <Typography.Text>
              {assigneeMap.get(assigneeUserId) ?? assigneeUserId}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">Sem responsável</Typography.Text>
          ),
      },
    ],
    [assigneeMap, onTicketSelect],
  );

  const handleTableChange: TableProps<SupportTicket>["onChange"] = (
    paginationConfig: TablePaginationConfig,
    _filters,
    _sorter,
  ) => {
    void _filters;
    void _sorter;

    const nextPage = paginationConfig.current ?? 1;
    const nextPageSize = paginationConfig.pageSize ?? pagination.pageSize;
    if (
      nextPage !== pagination.page ||
      nextPageSize !== pagination.pageSize
    ) {
      onPaginationChange(nextPage, nextPageSize);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <TicketFilters
        value={filters}
        onChange={(next) => {
          onPaginationChange(1, pagination.pageSize);
          onFiltersChange(next);
        }}
        viewerId={viewerId}
        loading={isFetching}
      />

      <Table<SupportTicket>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isFetching}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          position: ["bottomRight"],
        }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => onTicketSelect(record.id),
          role: "button",
        })}
        scroll={{ x: 980 }}
      />
    </Space>
  );
}
