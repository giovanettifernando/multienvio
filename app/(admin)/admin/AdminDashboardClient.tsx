"use client";

import { PageShell } from '@/shared/ui/PageShell';
import { Card, Col, Row, Statistic, Spin, Alert, Typography } from "antd";
import {
  InboxOutlined,
  CarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  DollarOutlined,
  CustomerServiceOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { formatCentsAsBRL } from "@/shared/utils/format";

interface DashboardKpis {
  shipmentsBacklog: number;
  shipmentsInTransit: number;
  shipmentsExceptions: number;
  shipmentsDeliveredToday: number;
  totalWalletBalanceCents: number;
  revenueThisMonthCents: number;
  pendingExpensesCents: number;
  ticketsOpen: number;
  ticketsHighPriority: number;
  totalClients: number;
  activeClients: number;
}

async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const res = await fetch("/api/admin/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao carregar dados");
  const json = await res.json();
  return json.data;
}

export default function AdminDashboardClient() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchDashboardKpis,
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <PageShell title="Visao geral" gap="md">
        <Alert
          message="Erro ao carregar dashboard"
          description="Nao foi possivel carregar os dados. Tente novamente."
          type="error"
          showIcon
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Visao geral" gap="md">
      <Spin spinning={isLoading}>
        {/* Operacoes */}
        <Typography.Title level={5} style={{ marginBottom: 16 }}>
          Operacoes
        </Typography.Title>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Backlog"
                value={data?.shipmentsBacklog ?? 0}
                prefix={<InboxOutlined />}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Em Transito"
                value={data?.shipmentsInTransit ?? 0}
                prefix={<CarOutlined />}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Excecoes"
                value={data?.shipmentsExceptions ?? 0}
                prefix={<WarningOutlined />}
                valueStyle={{ color: "#ff4d4f" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Entregues Hoje"
                value={data?.shipmentsDeliveredToday ?? 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Financeiro */}
        <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
          Financeiro
        </Typography.Title>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={8}>
            <Card size="small">
              <Statistic
                title="Saldo Total Clientes"
                value={formatCentsAsBRL(data?.totalWalletBalanceCents ?? 0)}
                prefix={<WalletOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8}>
            <Card size="small">
              <Statistic
                title="Receita do Mes"
                value={formatCentsAsBRL(data?.revenueThisMonthCents ?? 0)}
                prefix={<DollarOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8}>
            <Card size="small">
              <Statistic
                title="Despesas Pendentes"
                value={formatCentsAsBRL(data?.pendingExpensesCents ?? 0)}
                prefix={<DollarOutlined />}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Suporte e Clientes */}
        <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
          Suporte e Clientes
        </Typography.Title>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Tickets Abertos"
                value={data?.ticketsOpen ?? 0}
                prefix={<CustomerServiceOutlined />}
                valueStyle={
                  (data?.ticketsOpen ?? 0) > 0 ? { color: "#faad14" } : undefined
                }
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Alta Prioridade"
                value={data?.ticketsHighPriority ?? 0}
                prefix={<WarningOutlined />}
                valueStyle={
                  (data?.ticketsHighPriority ?? 0) > 0
                    ? { color: "#ff4d4f" }
                    : undefined
                }
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Total de Clientes"
                value={data?.totalClients ?? 0}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Clientes Ativos"
                value={data?.activeClients ?? 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </PageShell>
  );
}
