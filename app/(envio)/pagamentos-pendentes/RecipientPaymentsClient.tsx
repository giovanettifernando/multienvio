"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Badge,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  ReloadOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { PageShell } from '@/shared/ui/PageShell';
import { ELButton } from '@/shared/ui/ELButton';
import { ELSelect } from '@/shared/ui/ELSelect';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';

const { Text } = Typography;

type RecipientPaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

type RecipientPaymentRequest = {
  id: string;
  paymentToken: string;
  status: RecipientPaymentStatus;
  recipientName: string;
  recipientEmail: string;
  destinationCity: string;
  destinationState: string;
  totalCents: number;
  createdAt: string;
  expiresAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  shipmentId?: string | null;
};

type ListResponse = {
  requests: RecipientPaymentRequest[];
  total: number;
  hasMore: boolean;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "PAID", label: "Pagos" },
  { value: "EXPIRED", label: "Expirados" },
  { value: "CANCELLED", label: "Cancelados" },
];

const STATUS_CONFIG: Record<
  RecipientPaymentStatus,
  { color: string; label: string; icon: React.ReactNode }
> = {
  PENDING: {
    color: "processing",
    label: "Pendente",
    icon: <ClockCircleOutlined />,
  },
  PAID: {
    color: "success",
    label: "Pago",
    icon: <CheckCircleOutlined />,
  },
  EXPIRED: {
    color: "default",
    label: "Expirado",
    icon: <ClockCircleOutlined />,
  },
  CANCELLED: {
    color: "error",
    label: "Cancelado",
    icon: <CloseCircleOutlined />,
  },
};

export default function RecipientPaymentsClient() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Buscar lista de requests
  const { data, isLoading, refetch } = useQuery<ListResponse>({
    queryKey: ["recipient-payments", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const res = await fetch(`/api/recipient-payment/list?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar solicitacoes");
      const json = await res.json();
      return json.data;
    },
  });

  // Mutation para cancelar
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch("/api/recipient-payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao cancelar");
      }
      return res.json();
    },
    onSuccess: () => {
      message.success("Solicitacao cancelada");
      queryClient.invalidateQueries({ queryKey: ["recipient-payments"] });
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  // Mutation para reenviar
  const resendMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch("/api/recipient-payment/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao reenviar");
      }
      return res.json();
    },
    onSuccess: () => {
      message.success("Link reenviado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["recipient-payments"] });
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return "Expirado";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d restantes`;
    }
    return `${hours}h restantes`;
  };

  const copyPaymentLink = useCallback(
    (token: string) => {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const url = `${baseUrl}/pagar/${token}`;
      navigator.clipboard.writeText(url);
      message.success("Link copiado!");
    },
    [message]
  );

  const columns = [
    {
      title: "Destinatario",
      key: "recipient",
      render: (_: unknown, record: RecipientPaymentRequest) => (
        <div>
          <Text strong>{record.recipientName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.recipientEmail}
          </Text>
        </div>
      ),
    },
    {
      title: "Destino",
      key: "destination",
      render: (_: unknown, record: RecipientPaymentRequest) => (
        <Text>
          {record.destinationCity}/{record.destinationState}
        </Text>
      ),
    },
    {
      title: "Valor",
      key: "value",
      render: (_: unknown, record: RecipientPaymentRequest) => (
        <Text strong>{formatCurrency(record.totalCents)}</Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, record: RecipientPaymentRequest) => {
        const config = STATUS_CONFIG[record.status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Prazo",
      key: "expiration",
      render: (_: unknown, record: RecipientPaymentRequest) => {
        if (record.status !== "PENDING") {
          return <Text type="secondary">-</Text>;
        }
        const timeRemaining = getTimeRemaining(record.expiresAt);
        const isExpiringSoon =
          new Date(record.expiresAt).getTime() - Date.now() <
          24 * 60 * 60 * 1000;
        return (
          <Badge
            status={isExpiringSoon ? "warning" : "processing"}
            text={timeRemaining}
          />
        );
      },
    },
    {
      title: "Criado em",
      key: "createdAt",
      render: (_: unknown, record: RecipientPaymentRequest) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(record.createdAt)}
        </Text>
      ),
    },
    {
      title: "Acoes",
      key: "actions",
      width: 150,
      render: (_: unknown, record: RecipientPaymentRequest) => (
        <Space size={4}>
          {record.status === "PENDING" && (
            <>
              <Tooltip title="Copiar link">
                <ELButton
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyPaymentLink(record.paymentToken)}
                />
              </Tooltip>
              <Tooltip title="Reenviar e-mail">
                <ELButton
                  size="small"
                  icon={<SendOutlined />}
                  loading={resendMutation.isPending}
                  onClick={() => resendMutation.mutate(record.id)}
                />
              </Tooltip>
              <Popconfirm
                title="Cancelar solicitacao?"
                description="Esta acao nao pode ser desfeita."
                onConfirm={() => cancelMutation.mutate(record.id)}
                okText="Sim, cancelar"
                cancelText="Nao"
              >
                <Tooltip title="Cancelar">
                  <ELButton
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={cancelMutation.isPending}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {record.status === "PAID" && record.shipmentId && (
            <Tooltip title="Ver envio">
              <ELButton
                size="small"
                onClick={() =>
                  (window.location.href = `/shipments/${record.shipmentId}`)
                }
              >
                Ver envio
              </ELButton>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (!data && isLoading) {
    return (
      <PageShell title="Pagamentos pelo Destinatario">
        <ELSkeleton active paragraph={{ rows: 6 }} />
      </PageShell>
    );
  }

  return (
    <PageShell title="Pagamentos pelo Destinatario">
      <div>
        {/* Filtros */}
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <ELSelect
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <ELButton
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Atualizar
          </ELButton>
        </div>

        {/* Tabela */}
        {data?.requests && data.requests.length > 0 ? (
          <Table
            dataSource={data.requests}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={{
              current: page,
              pageSize,
              total: data.total,
              onChange: (newPage) => setPage(newPage),
              showSizeChanger: false,
              showTotal: (total) => `${total} solicitacao(es)`,
            }}
            size="small"
          />
        ) : (
          <Empty
            description={
              statusFilter
                ? "Nenhuma solicitacao encontrada com este filtro"
                : "Voce ainda nao tem solicitacoes de pagamento"
            }
          />
        )}
      </div>
    </PageShell>
  );
}
