"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Tabs,
  Button,
  Spin,
  Result,
  Typography,
  Tag,
  Descriptions,
  Avatar,
  Badge,
  Row,
  Col,
  Space,
  Select,
  Divider,
  App,
} from "antd";
import {
  ArrowLeftOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CreditCardOutlined,
  TeamOutlined,
  ShoppingOutlined,
  WalletOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { PageShell } from "@/components/shared/PageShell";
import AdminClientProfile from "@/components/admin/clients/AdminClientProfile";
import AdminClientAddresses from "@/components/admin/clients/AdminClientAddresses";
import AdminClientCards from "@/components/admin/clients/AdminClientCards";
import AdminClientRecipients from "@/components/admin/clients/AdminClientRecipients";
import AdminClientRecurringItems from "@/components/admin/clients/AdminClientRecurringItems";
import AdminClientWallet from "@/components/admin/clients/AdminClientWallet";
import { formatNumberBR } from "@/lib/format";

const { Title, Text } = Typography;

interface ClientDetails {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf: string | null;
    cnpj: string | null;
    hasCompany: boolean;
    razaoSocial: string | null;
    status: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    authProvider: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    type: string;
    document: string | null;
  };
  addresses: Array<{
    id: string;
    label: string | null;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    isDefault: boolean;
  }>;
  cards: Array<{
    id: string;
    brand: string;
    holderName: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>;
  recipients: Array<{
    id: string;
    name: string;
    email: string | null;
    document: string | null;
    phone: string | null;
    notes: string | null;
    isDefault: boolean;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
  }>;
  recurringItems: Array<{
    id: string;
    descricao: string;
    valorUnitario: number;
  }>;
  wallet: {
    id: string;
    availableCents: number;
    pendingCents: number;
    availableReais: number;
    pendingReais: number;
    hasNegativeBalance: boolean;
    monthlyCredits: number;
    monthlyDebits: number;
  } | null;
  stats: {
    totalShipments: number;
    totalAddresses: number;
    totalCards: number;
    totalRecipients: number;
    totalRecurringItems: number;
  };
}

async function fetchClientDetails(id: string): Promise<ClientDetails> {
  const res = await fetch(`/api/admin/clients/${id}/details`);
  if (!res.ok) {
    throw new Error("Erro ao carregar dados do usuário");
  }
  return res.json();
}

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "pending", label: "Pendente" },
  { value: "blocked", label: "Bloqueado" },
  { value: "suspended", label: "Suspenso" },
];

export default function AdminClientDetailsPage() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [statusLoading, setStatusLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "client", clientId, "details"],
    queryFn: () => fetchClientDetails(clientId),
    enabled: !!clientId,
  });

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao alterar status");
      }

      message.success("Status alterado com sucesso");
      refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao alterar status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSendResetPassword = async () => {
    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/clients/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [clientId] }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Erro ao enviar email");
      }

      message.success(result.message || "Email de redefinição enviado");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao enviar email");
    } finally {
      setResetLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell title="Carregando..." description="">
        <div style={{ textAlign: "center", padding: 100 }}>
          <Spin size="large" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Erro" description="">
        <Result
          status="error"
          title="Erro ao carregar dados"
          subTitle="Não foi possível carregar os dados do usuário."
          extra={[
            <Button key="back" onClick={() => router.push("/admin/contas")}>
              Voltar para lista
            </Button>,
            <Button key="retry" type="primary" onClick={() => refetch()}>
              Tentar novamente
            </Button>,
          ]}
        />
      </PageShell>
    );
  }

  const { user, stats, wallet } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "blocked":
        return "error";
      case "suspended":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "pending":
        return "Pendente";
      case "blocked":
        return "Bloqueado";
      case "suspended":
        return "Suspenso";
      default:
        return status;
    }
  };

  const tabItems = [
    {
      key: "profile",
      label: (
        <span>
          <UserOutlined /> Perfil
        </span>
      ),
      children: (
        <AdminClientProfile
          clientId={clientId}
          user={data.user}
          onUpdate={() => refetch()}
        />
      ),
    },
    {
      key: "addresses",
      label: (
        <span>
          <EnvironmentOutlined /> Endereços
          <Badge count={stats.totalAddresses} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <AdminClientAddresses
          clientId={clientId}
          addresses={data.addresses}
          onUpdate={() => refetch()}
        />
      ),
    },
    {
      key: "cards",
      label: (
        <span>
          <CreditCardOutlined /> Cartões
          <Badge count={stats.totalCards} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <AdminClientCards
          clientId={clientId}
          cards={data.cards}
          onUpdate={() => refetch()}
        />
      ),
    },
    {
      key: "recipients",
      label: (
        <span>
          <TeamOutlined /> Destinatários
          <Badge count={stats.totalRecipients} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <AdminClientRecipients
          clientId={clientId}
          recipients={data.recipients}
          onUpdate={() => refetch()}
        />
      ),
    },
    {
      key: "items",
      label: (
        <span>
          <ShoppingOutlined /> Itens Recorrentes
          <Badge count={stats.totalRecurringItems} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <AdminClientRecurringItems
          clientId={clientId}
          items={data.recurringItems}
          onUpdate={() => refetch()}
        />
      ),
    },
    {
      key: "wallet",
      label: (
        <span>
          <WalletOutlined /> Carteira
          {wallet?.hasNegativeBalance && (
            <Tag color="error" style={{ marginLeft: 8 }}>
              Negativo
            </Tag>
          )}
        </span>
      ),
      children: (
        <AdminClientWallet
          clientId={clientId}
          wallet={data.wallet}
          onUpdate={() => refetch()}
        />
      ),
    },
  ];

  return (
    <PageShell
      title=""
      description=""
      extra={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/contas")}
        >
          Voltar para lista
        </Button>
      }
    >
      <Row gutter={16}>
        {/* Sidebar - User Info */}
        <Col xs={24} lg={6}>
          <Card style={{ marginBottom: 16, textAlign: "center" }}>
            <Avatar
              size={100}
              src={user.avatarUrl}
              icon={!user.avatarUrl && <UserOutlined />}
              style={{ backgroundColor: "#1890ff", marginBottom: 16 }}
            />
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              {user.name}
            </Title>
            <Space wrap style={{ justifyContent: "center", marginBottom: 12 }}>
              <Tag color={getStatusColor(user.status)}>
                {getStatusLabel(user.status)}
              </Tag>
              <Tag color={user.type === "PJ" ? "blue" : "green"}>
                {user.type}
              </Tag>
              {user.emailVerified ? (
                <Tag color="success">Email verificado</Tag>
              ) : (
                <Tag color="warning">Email não verificado</Tag>
              )}
            </Space>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: "block" }}>
                {user.email}
              </Text>
              {user.phone && (
                <Text type="secondary" style={{ display: "block" }}>
                  {user.phone}
                </Text>
              )}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Envios">
                <strong>{stats.totalShipments}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Saldo">
                <strong
                  style={{
                    color: wallet?.hasNegativeBalance ? "#ff4d4f" : "#52c41a",
                  }}
                >
                  R$ {formatNumberBR(wallet?.availableReais ?? 0)}
                </strong>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0" }} />

            {/* Status Select */}
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Status da conta
              </Text>
              <Select
                value={user.status}
                onChange={handleStatusChange}
                loading={statusLoading}
                options={STATUS_OPTIONS}
                style={{ width: "100%" }}
              />
            </div>

            {/* Reset Password Button */}
            <Button
              icon={<MailOutlined />}
              onClick={handleSendResetPassword}
              loading={resetLoading}
              block
            >
              Enviar redefinição de senha
            </Button>
          </Card>
        </Col>

        {/* Main Content - Tabs */}
        <Col xs={24} lg={18}>
          <Card>
            <Tabs items={tabItems} defaultActiveKey="profile" />
          </Card>
        </Col>
      </Row>
    </PageShell>
  );
}
