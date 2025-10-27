"use client";

import { useCallback } from "react";
import { Flex, Input, Select, Space } from "antd";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import type { TicketCategory, TicketStatus } from "@/lib/support/types";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/support/utils";

export type AssigneeFilterValue = "all" | "me" | "unassigned";

export interface TicketFiltersValue {
  q?: string;
  status?: TicketStatus | "all";
  category?: TicketCategory | "all";
  assignee?: AssigneeFilterValue;
}

interface TicketFiltersProps {
  value: TicketFiltersValue;
  onChange: (value: TicketFiltersValue) => void;
  viewerId?: string;
  loading?: boolean;
}

const statusOptions = (Object.entries(TICKET_STATUS_LABEL) as Array<[TicketStatus, string]>).map(
  ([value, label]) => ({ label, value }),
);

const categoryOptions = (
  Object.entries(TICKET_CATEGORY_LABEL) as Array<[TicketCategory, string]>
).map(([value, label]) => ({ label, value }));

const assigneeOptions: Array<{ label: string; value: AssigneeFilterValue }> = [
  { label: "Todos", value: "all" },
  { label: "Atribuídos a mim", value: "me" },
  { label: "Sem responsável", value: "unassigned" },
];

export function TicketFilters({ value, onChange, viewerId, loading }: TicketFiltersProps) {
  const handleUpdate = useCallback(
    (patch: Partial<TicketFiltersValue>) => {
      onChange({ ...value, ...patch });
    },
    [onChange, value],
  );

  const disableAssigneeMe = !viewerId;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Flex gap={8} wrap>
        <Input
          allowClear
          value={value.q ?? ""}
          placeholder="Buscar por ID, título ou vínculo"
          prefix={<SearchOutlined />}
          onChange={(event) => handleUpdate({ q: event.target.value })}
          onPressEnter={(event) =>
            handleUpdate({ q: (event.target as HTMLInputElement).value.trim() })
          }
          style={{ flex: "1 1 260px", minWidth: 220 }}
          disabled={loading}
        />
        <Select
          value={value.status ?? "all"}
          onChange={(next) => handleUpdate({ status: next })}
          options={[{ label: "Status", value: "all" }, ...statusOptions]}
          style={{ minWidth: 150 }}
          suffixIcon={<FilterOutlined />}
          disabled={loading}
        />
        <Select
          value={value.category ?? "all"}
          onChange={(next) => handleUpdate({ category: next })}
          options={[{ label: "Categoria", value: "all" }, ...categoryOptions]}
          style={{ minWidth: 160 }}
          suffixIcon={<FilterOutlined />}
          disabled={loading}
        />
        <Select
          value={value.assignee ?? "all"}
          onChange={(next) => handleUpdate({ assignee: next })}
          options={assigneeOptions.map((option) => ({
            ...option,
            disabled: option.value === "me" && disableAssigneeMe,
          }))}
          style={{ minWidth: 170 }}
          suffixIcon={<FilterOutlined />}
          disabled={loading}
        />
      </Flex>
    </Space>
  );
}
