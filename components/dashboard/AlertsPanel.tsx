"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Card,
  Empty,
  List,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import type { SupportTicket } from "@/lib/validation/support";
import type { Pickup } from "@/types/pickup";
import { useRouter } from "next/navigation";

type AlertItem = {
  id: string;
  title: string;
  description: string;
  type: "ticket" | "pickup" | "warning";
  severity: "high" | "medium" | "low";
  link?: string;
};

async function fetchOpenTickets(): Promise<SupportTicket[]> {
  const params = new URLSearchParams();
  params.append("status", "aberto");
  const response = await fetch(`/api/support/tickets?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar os tickets.");
  }
  const data = await response.json();
  return Array.isArray(data.tickets) ? data.tickets : [];
}

async function fetchPickups(): Promise<Pickup[]> {
  const response = await fetch("/api/pickups");
  if (!response.ok) {
    throw new Error("Não foi possível carregar as coletas.");
  }
  const data = await response.json();
  return data.dados ?? [];
}

export function AlertsPanel() {
  const router = useRouter();
  const ticketsQuery = useQuery({
    queryKey: ["support", "tickets", "open"],
    queryFn: fetchOpenTickets,
    staleTime: 30_000,
  });

  const pickupsQuery = useQuery({
    queryKey: ["pickups", "list"],
    queryFn: fetchPickups,
    staleTime: 30_000,
  });

  const alerts = useMemo<AlertItem[]>(() => {
    const entries: AlertItem[] = [];
    const tickets = ticketsQuery.data ?? [];
    const pickups = pickupsQuery.data ?? [];

    tickets.slice(0, 3).forEach((ticket) => {
      entries.push({
        id: ticket.id,
        title: `Ticket ${ticket.id.slice(0, 8)}`,
        description: ticket.subject,
        type: "ticket",
        severity: ticket.priority === "critica" ? "high" : "medium",
        link: `/suporte/${ticket.id}`,
      });
    });

    const pendingPickups = pickups.filter((pickup) =>
      ["REQUESTED", "SCHEDULED", "ASSIGNED"].includes(pickup.status),
    );
    pendingPickups.slice(0, 2).forEach((pickup) => {
      entries.push({
        id: pickup.id,
        title: "Coleta pendente",
        description: `Coleta solicitada para ${new Date(pickup.schedule.date).toLocaleDateString(
          "pt-BR",
        )}`,
        type: "pickup",
        severity: "medium",
        link: "/coletas",
      });
    });

    entries.push({
      id: "weight_divergence",
      title: "Divergência de peso",
      description: "Envio BR123456789BR cobrado com 1,2 kg acima do declarado.",
      type: "warning",
      severity: "low",
      link: "/shipments",
    });

    entries.push({
      id: "invoice_due",
      title: "Fatura a vencer",
      description: "Fatura de junho vence em 3 dias. Evite bloqueios no faturamento.",
      type: "warning",
      severity: "medium",
      link: "/carteira",
    });

    return entries;
  }, [pickupsQuery.data, ticketsQuery.data]);

  const loading = ticketsQuery.isLoading || pickupsQuery.isLoading;
  const hasError = ticketsQuery.isError || pickupsQuery.isError;

  return (
    <Card
      title={
        <Space>
          Alertas &amp; pendências
          <Badge count={alerts.length} />
        </Space>
      }
      variant="outlined"
      styles={{ body: { paddingTop: 0 } }}
    >
      {hasError ? (
        <Alert
          type="warning"
          message="Não foi possível carregar todos os alertas. Tente novamente em instantes."
          showIcon
        />
      ) : null}

      {loading ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 2 }} />
        </Space>
      ) : alerts.length === 0 ? (
        <Empty
          description="Nenhum alerta no momento"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={alerts}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: item.link ? "pointer" : "default" }}
              onClick={() => {
                if (item.link) {
                  router.push(item.link);
                }
              }}
            >
              <List.Item.Meta
                title={
                  <Space size={8}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag
                      color={
                        item.severity === "high"
                          ? "red"
                          : item.severity === "medium"
                          ? "orange"
                          : "default"
                      }
                    >
                      {item.severity === "high"
                        ? "Alta"
                        : item.severity === "medium"
                        ? "Média"
                        : "Baixa"}
                    </Tag>
                  </Space>
                }
                description={
                  <Typography.Text type="secondary">{item.description}</Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
