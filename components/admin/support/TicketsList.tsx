"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  App,
  Badge,
  Empty,
  Flex,
  Input,
  List,
  Pagination,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  CustomerServiceOutlined,
  FilterOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { TicketStatus, TicketCategory } from "@/lib/support/types";
import { useTickets, type TicketListParams } from "@/lib/support/hooks";
import { adminMockUsers } from "@/lib/admin/mock-users";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL } from "@/lib/support/utils";

type AssigneeFilter = "all" | "me" | "unassigned";

type FilterState = {
  q: string;
  status: TicketStatus | "all";
  category: TicketCategory | "all";
  assignee: AssigneeFilter;
};

const statusOptions = (Object.entries(TICKET_STATUS_LABEL) as Array<[TicketStatus, string]>).map(
  ([value, label]) => ({
    label,
    value,
  }),
);

const categoryOptions = (
  Object.entries(TICKET_CATEGORY_LABEL) as Array<[TicketCategory, string]>
).map(([value, label]) => ({
  label,
  value,
}));

const assigneeOptions: Array<{ label: string; value: AssigneeFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Atribuídos a mim", value: "me" },
  { label: "Sem responsável", value: "unassigned" },
];

const assigneesMap = new Map(adminMockUsers.map((user) => [user.id, user.name]));

function truncate(text: string, limit = 160): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

function formatDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

function formatSla(date?: string | null) {
  if (!date) return null;
  const formatted = dayjs(date).format("DD/MM HH:mm");
  const overdue = dayjs(date).isBefore(dayjs());
  return { formatted, overdue };
}

interface TicketsListProps {
  viewerId?: string;
  selectedTicketId?: string | null;
  onSelect(ticketId: string | null): void;
}

export function TicketsList({ viewerId, selectedTicketId, onSelect }: TicketsListProps) {
  const { message } = App.useApp();
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    status: "all",
    category: "all",
    assignee: "all",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryParams = useMemo<TicketListParams>(() => {
    return {
      q: filters.q || undefined,
      status: filters.status,
      category: filters.category,
      assignee: filters.assignee,
      viewerId: filters.assignee === "me" ? viewerId : undefined,
      page,
      pageSize,
    };
  }, [filters, page, pageSize, viewerId]);

  const { data, isFetching, error } = useTickets(queryParams);

  useEffect(() => {
    if (error) {
      const text =
        error instanceof Error ? error.message : "Não foi possível carregar os tickets.";
      message.error(text);
    }
  }, [error, message]);

  useEffect(() => {
    if (!selectedTicketId && data?.items?.length) {
      onSelect(data.items[0].id);
    }
  }, [data?.items, onSelect, selectedTicketId]);

  useEffect(() => {
    if (
      selectedTicketId &&
      data &&
      !data.items.some((ticket) => ticket.id === selectedTicketId)
    ) {
      if (data.items[0]) {
        onSelect(data.items[0].id);
      } else {
        onSelect(null);
      }
    }
  }, [data, onSelect, selectedTicketId]);

  const handleSearch = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      q: value.trim(),
    }));
    setPage(1);
  };

  const handleFilterChange = <T extends keyof FilterState>(key: T, value: FilterState[T]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(1);
  };

  const disableAssigneeMe = !viewerId;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Flex align="center" justify="space-between">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Chamados de Suporte
          </Typography.Title>
          <Badge
            count={data?.total ?? 0}
            overflowCount={999}
            title="Total de tickets"
            showZero
          />
        </Flex>

        <Space size={8} wrap style={{ width: "100%" }}>
          <Input
            allowClear
            placeholder="Buscar por ID, título ou vínculo"
            prefix={<SearchOutlined />}
            value={filters.q}
            onChange={(event) => handleSearch(event.target.value)}
            onPressEnter={(event) => handleSearch((event.target as HTMLInputElement).value)}
            style={{ flex: "1 1 100%", minWidth: 220 }}
          />
          <Select
            value={filters.status}
            onChange={(value) => handleFilterChange("status", value)}
            style={{ minWidth: 140 }}
            options={[{ label: "Status", value: "all" }, ...statusOptions]}
            suffixIcon={<FilterOutlined />}
          />
          <Select
            value={filters.category}
            onChange={(value) => handleFilterChange("category", value)}
            style={{ minWidth: 140 }}
            options={[{ label: "Categoria", value: "all" }, ...categoryOptions]}
            suffixIcon={<FilterOutlined />}
          />
          <Select
            value={filters.assignee}
            onChange={(value) => handleFilterChange("assignee", value)}
            style={{ minWidth: 170 }}
            options={assigneeOptions.map((option) => ({
              ...option,
              disabled: option.value === "me" && disableAssigneeMe,
            }))}
            suffixIcon={<FilterOutlined />}
          />
        </Space>
      </Space>

      <List
        dataSource={data?.items ?? []}
        loading={isFetching}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Nenhum ticket encontrado."
            />
          ),
        }}
        renderItem={(ticket) => {
          const slaInfo = formatSla(ticket.slaDueAt);
          const isSelected = ticket.id === selectedTicketId;
          return (
            <List.Item
              key={ticket.id}
              style={{
                cursor: "pointer",
                borderRadius: 12,
                border: `1px solid ${
                  isSelected ? "var(--color-primary)" : "var(--color-border)"
                }`,
                background: isSelected ? "rgba(28, 100, 242, 0.06)" : "#fff",
                transition: "border-color 0.2s, background 0.2s",
                padding: 16,
              }}
              onClick={() => onSelect(ticket.id)}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Flex justify="space-between" align="center">
                  <Space>
                    <Typography.Text
                      style={{
                        fontFamily: "monospace",
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {ticket.id}
                    </Typography.Text>
                    <Tag
                      color={TICKET_STATUS_COLOR[ticket.status]}
                      style={{ borderRadius: 999 }}
                    >
                      {TICKET_STATUS_LABEL[ticket.status]}
                    </Tag>
                    <Tag icon={<CustomerServiceOutlined />} style={{ borderRadius: 999 }}>
                      {TICKET_CATEGORY_LABEL[ticket.category]}
                    </Tag>
                  </Space>
                  {slaInfo ? (
                    <Tag
                      color={slaInfo.overdue ? "red" : "blue"}
                      style={{ borderRadius: 999 }}
                      icon={<ClockCircleOutlined />}
                    >
                      SLA até {slaInfo.formatted}
                    </Tag>
                  ) : (
                    <Tag style={{ borderRadius: 999 }} icon={<ClockCircleOutlined />}>
                      Sem SLA
                    </Tag>
                  )}
                </Flex>

                <Typography.Text strong style={{ fontSize: 15 }}>
                  {ticket.title}
                </Typography.Text>
                <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
                  {truncate(ticket.description)}
                </Typography.Paragraph>
                <Flex justify="space-between" align="center">
                  <Typography.Text type="secondary">
                    Última atualização {formatDate(ticket.updatedAt)}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {ticket.assigneeUserId
                      ? `Resp.: ${assigneesMap.get(ticket.assigneeUserId) ?? ticket.assigneeUserId}`
                      : "Sem responsável"}
                  </Typography.Text>
                </Flex>
              </Space>
            </List.Item>
          );
        }}
      />

      <Pagination
        current={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        showSizeChanger
        hideOnSinglePage={(data?.total ?? 0) <= pageSize}
        onChange={(nextPage, nextPageSize) => {
          if (nextPageSize !== pageSize) {
            setPageSize(nextPageSize);
            setPage(1);
          } else {
            setPage(nextPage);
          }
        }}
        style={{ alignSelf: "flex-end" }}
      />
    </Space>
  );
}
