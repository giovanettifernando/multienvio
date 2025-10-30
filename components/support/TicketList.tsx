"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import { SupportPriority, SupportStatus } from "@/types/contracts";
import type { Ticket, TicketPriority, TicketStatus, TicketCategory } from "@/types/support";
import { TicketStatusTag } from "@/components/support/TicketStatusTag";

type Props = {
  filters: URLSearchParams;
  onOpenTicket: (id: string) => void;
  onFiltersChange?: (next: URLSearchParams) => void;
};

type TicketListResponse = {
  dados: Ticket[];
  total: number;
  page: number;
  size: number;
};

async function fetchTickets(params: URLSearchParams): Promise<TicketListResponse> {
  const response = await fetch(`/api/support/tickets?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.mensagem ?? "Não foi possível carregar os tickets");
  }
  const data = (await response.json()) as TicketListResponse;
  return {
    dados: data.dados ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    size: data.size ?? 20,
  };
}

const priorityColor: Record<TicketPriority, string> = {
  [SupportPriority.BAIXA]: "default",
  [SupportPriority.MEDIA]: "blue",
  [SupportPriority.ALTA]: "orange",
  [SupportPriority.CRITICA]: "red",
};

const priorityLabel: Record<TicketPriority, string> = {
  [SupportPriority.BAIXA]: "Baixa",
  [SupportPriority.MEDIA]: "Média",
  [SupportPriority.ALTA]: "Alta",
  [SupportPriority.CRITICA]: "Crítica",
};

const statusOptions: Array<{ label: string; value: TicketStatus }> = [
  { label: "Aberto", value: SupportStatus.ABERTO },
  { label: "Em Atendimento", value: SupportStatus.EM_ATENDIMENTO },
  { label: "Resolvido", value: SupportStatus.RESOLVIDO },
  { label: "Fechado", value: SupportStatus.FECHADO },
];

const priorityOptions = Object.entries(priorityLabel).map(([value, label]) => ({
  label,
  value: value as TicketPriority,
}));

const categoryOptions: Array<{ label: string; value: TicketCategory }> = [
  { label: "Financeiro", value: "FINANCEIRO" },
  { label: "Logística", value: "LOGISTICA" },
  { label: "Etiqueta", value: "ETIQUETA" },
  { label: "Rastreamento", value: "RASTREAMENTO" },
  { label: "Coletas", value: "COLETAS" },
  { label: "Outros", value: "OUTROS" },
];

function buildNextFilters(
  filters: URLSearchParams,
  key: string,
  value: string | undefined,
): URLSearchParams {
  const next = new URLSearchParams(filters.toString());
  if (value) {
    next.set(key, value);
  } else {
    next.delete(key);
  }
  next.delete("page");
  return next;
}

export function TicketList({ filters, onOpenTicket, onFiltersChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", filters.toString()],
    queryFn: () => fetchTickets(filters),
  });

  useEffect(() => {
    if (error) {
      const text = error instanceof Error ? error.message : "Erro ao carregar tickets";
      message.error(text);
    }
  }, [error]);

  const currentPage = Number.parseInt(filters.get("page") ?? `${data?.page ?? 1}`, 10) || 1;
  const pageSize = Number.parseInt(filters.get("size") ?? `${data?.size ?? 20}`, 10) || 20;

  const handleTableChange = (pagination: TablePaginationConfig) => {
    if (!onFiltersChange) return;
    const next = new URLSearchParams(filters.toString());
    if (pagination.current) {
      next.set("page", String(pagination.current));
    }
    if (pagination.pageSize) {
      next.set("size", String(pagination.pageSize));
    }
    onFiltersChange(next);
  };

  const columns = useMemo(
    () => [
      {
        title: "Número",
        dataIndex: "number",
        key: "number",
        render: (value: string) => (
          <Typography.Text style={{ fontFamily: "monospace" }}>{value}</Typography.Text>
        ),
      },
      {
        title: "Título",
        dataIndex: "title",
        key: "title",
        ellipsis: true,
      },
      {
        title: "Categoria",
        dataIndex: "category",
        key: "category",
        render: (value: TicketCategory) => categoryOptions.find((option) => option.value === value)?.label ?? value,
      },
      {
        title: "Prioridade",
        dataIndex: "priority",
        key: "priority",
        render: (value: TicketPriority) => (
          <Tag color={priorityColor[value]}>{priorityLabel[value]}</Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (value: TicketStatus) => <TicketStatusTag status={value} />,
      },
      {
        title: "Atualizado em",
        dataIndex: "updatedAt",
        key: "updatedAt",
        render: (value: string) => new Date(value).toLocaleString("pt-BR"),
      },
      {
        title: "Ações",
        key: "actions",
        render: (_: unknown, record: Ticket) => (
          <Button type="link" onClick={() => onOpenTicket(record.id)} aria-label={`Ver ticket ${record.number}`}>
            Ver detalhes
          </Button>
        ),
      },
    ],
    [onOpenTicket],
  );

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Flex gap={12} wrap align="center">
        <Input.Search
          key={`search-${filters.get("q") ?? ""}`}
          placeholder="Buscar por número, título ou vínculo"
          allowClear
          style={{ maxWidth: 320 }}
          disabled={!onFiltersChange}
          onSearch={(value) => {
            if (!onFiltersChange) return;
            const next = buildNextFilters(filters, "q", value.trim() || undefined);
            onFiltersChange(next);
          }}
          onChange={(event) => {
            if (!onFiltersChange) return;
            if (event.target.value === "") {
              const next = buildNextFilters(filters, "q", undefined);
              onFiltersChange(next);
            }
          }}
          aria-label="Buscar tickets"
        />
        <Select
          allowClear
          placeholder="Status"
          options={statusOptions}
          value={filters.get("status") ?? undefined}
          disabled={!onFiltersChange}
          onChange={(value) => {
            if (!onFiltersChange) return;
            const next = buildNextFilters(filters, "status", value ?? undefined);
            onFiltersChange(next);
          }}
          aria-label="Filtrar por status"
        />
        <Select
          allowClear
          placeholder="Prioridade"
          options={priorityOptions}
          value={filters.get("priority") ?? undefined}
          disabled={!onFiltersChange}
          onChange={(value) => {
            if (!onFiltersChange) return;
            const next = buildNextFilters(filters, "priority", value ?? undefined);
            onFiltersChange(next);
          }}
          aria-label="Filtrar por prioridade"
        />
        <Select
          allowClear
          placeholder="Categoria"
          options={categoryOptions}
          value={filters.get("category") ?? undefined}
          disabled={!onFiltersChange}
          onChange={(value) => {
            if (!onFiltersChange) return;
            const next = buildNextFilters(filters, "category", value ?? undefined);
            onFiltersChange(next);
          }}
          aria-label="Filtrar por categoria"
        />
        <Tooltip title="Limpar filtros aplicados">
          <Button
            disabled={!onFiltersChange}
            onClick={() => {
              if (!onFiltersChange) return;
              const next = new URLSearchParams();
              next.set('status', 'OPEN');
              onFiltersChange(next);
            }}
          >
            Limpar
          </Button>
        </Tooltip>
      </Flex>
      <Table
        rowKey="id"
        dataSource={data?.dados ?? []}
        loading={isLoading}
        pagination={{
          current: currentPage,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} de ${total}`,
        }}
        onChange={handleTableChange}
        columns={columns}
        scroll={{ x: 800 }}
        aria-label="Lista de tickets de suporte"
      />
    </Space>
  );
}
