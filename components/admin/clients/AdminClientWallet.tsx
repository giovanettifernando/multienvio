"use client";

import { useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Form,
  Input,
  InputNumber,
  Radio,
  message,
  Table,
  Tag,
  Typography,
  Alert,
  Empty,
  DatePicker,
} from "antd";
import { ELModal } from '@/components/ui/ELModal';
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/lib/utils/format";
import {
  PlusOutlined,
  MinusOutlined,
  WalletOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { formatNumberBR } from "@/lib/format";
import dayjs, { Dayjs } from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface WalletData {
  id: string;
  availableCents: number;
  pendingCents: number;
  availableReais: number;
  pendingReais: number;
  hasNegativeBalance: boolean;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  amountCents: number;
  amountReais: number;
  direction: string;
  title: string | null;
  createdAt: string;
}

interface AdminClientWalletProps {
  clientId: string;
  wallet: WalletData | null;
  onUpdate: () => void;
}

interface WalletResponse {
  wallet: WalletData;
  periodStats: {
    credits: number;
    debits: number;
    creditsReais: number;
    debitsReais: number;
  };
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startDate: string;
  endDate: string;
}

async function fetchWalletDetails(
  clientId: string,
  startDate?: string,
  endDate?: string,
  page?: number
): Promise<WalletResponse | null> {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (page) params.set("page", page.toString());

  const url = `/api/admin/clients/${clientId}/wallet${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

// Formatter para valores em formato brasileiro
const formatBRL = (value: number | string | undefined) => {
  if (value === undefined || value === null) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `R$ ${formatNumberBR(num)}`;
};

export default function AdminClientWallet({
  clientId,
  wallet: initialWallet,
  onUpdate,
}: AdminClientWalletProps) {
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [currentPage, setCurrentPage] = useState(1);

  // Filtro de datas - padrão últimos 30 dias
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);

  const { data: walletData, refetch } = useQuery({
    queryKey: [
      "admin",
      "client",
      clientId,
      "wallet",
      dateRange[0]?.toISOString(),
      dateRange[1]?.toISOString(),
      currentPage,
    ],
    queryFn: () =>
      fetchWalletDetails(
        clientId,
        dateRange[0]?.toISOString(),
        dateRange[1]?.toISOString(),
        currentPage
      ),
    staleTime: 0, // Sempre buscar dados atualizados
  });

  const wallet = walletData?.wallet || initialWallet;

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
      setCurrentPage(1); // Reset para primeira página ao mudar filtro
    }
  };

  const handleAdjust = async (values: {
    type: "credit" | "debit";
    amount: number;
    reason: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/wallet/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          amountCents: Math.round(values.amount * 100),
          reason: values.reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao ajustar saldo");
      }

      const data = await res.json();
      message.success(data.message);
      setAdjustModalOpen(false);
      form.resetFields();
      refetch();
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao ajustar saldo");
    } finally {
      setLoading(false);
    }
  };

  const transactionColumns: ColumnsType<Transaction> = [
    {
      title: "Data",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (date) =>
        new Date(date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      title: "Descrição",
      dataIndex: "title",
      key: "title",
      render: (title) => title || "-",
    },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type) => {
        const labels: Record<string, string> = {
          TOPUP: "Recarga",
          PURCHASE: "Compra",
          REFUND: "Estorno",
          WITHDRAW: "Saque",
          ADJUSTMENT: "Ajuste",
        };
        return labels[type] || type;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status) => {
        const colors: Record<string, string> = {
          CONFIRMED: "success",
          PENDING: "warning",
          FAILED: "error",
          CANCELED: "default",
        };
        const labels: Record<string, string> = {
          CONFIRMED: "Confirmado",
          PENDING: "Pendente",
          FAILED: "Falhou",
          CANCELED: "Cancelado",
        };
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
      },
    },
    {
      title: "Valor",
      dataIndex: "amountReais",
      key: "amountReais",
      width: 140,
      align: "right",
      render: (value, record) => (
        <Text
          strong
          style={{ color: record.direction === "credit" ? "#52c41a" : "#ff4d4f" }}
        >
          {record.direction === "credit" ? "+" : "-"} R${" "}
          {formatNumberBR(Math.abs(value))}
        </Text>
      ),
    },
  ];

  if (!wallet) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Este usuário ainda não possui carteira"
      >
        <Button type="primary" onClick={() => setAdjustModalOpen(true)}>
          Criar carteira e adicionar saldo
        </Button>

        <ELModal
          title="Ajustar saldo da carteira"
          open={adjustModalOpen}
          onCancel={() => setAdjustModalOpen(false)}
          footer={null}
          size="sm"
        >
          <Form form={form} layout="vertical" onFinish={handleAdjust}>
            <Form.Item
              name="type"
              label="Tipo de ajuste"
              rules={[{ required: true, message: "Selecione o tipo" }]}
              initialValue="credit"
            >
              <Radio.Group>
                <Radio.Button value="credit">
                  <PlusOutlined /> Crédito
                </Radio.Button>
                <Radio.Button value="debit">
                  <MinusOutlined /> Débito
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="amount"
              label="Valor (R$)"
              rules={[
                { required: true, message: "Informe o valor" },
                { type: "number", min: 0.01, message: "Valor mínimo: R$ 0,01" },
              ]}
            >
              <InputNumber
                min={0.01}
                step={0.01}
                precision={2}
                style={{ width: "100%" }}
                prefix="R$"
                decimalSeparator=","
                formatter={inputNumberFormatterBRL}
                parser={inputNumberParserBRL}
              />
            </Form.Item>

            <Form.Item
              name="reason"
              label="Motivo"
              rules={[
                { required: true, message: "Informe o motivo" },
                { min: 3, message: "Mínimo 3 caracteres" },
              ]}
            >
              <Input.TextArea rows={3} placeholder="Descreva o motivo do ajuste" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button onClick={() => setAdjustModalOpen(false)}>Cancelar</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Confirmar ajuste
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </ELModal>
      </Empty>
    );
  }

  return (
    <>
      {wallet.hasNegativeBalance && (
        <Alert
          type="error"
          showIcon
          message="Saldo negativo"
          description={`Este usuário possui um saldo negativo de R$ ${formatNumberBR(Math.abs(wallet.availableReais))}. O acesso a cotações está bloqueado até a regularização.`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Cards de resumo */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Saldo Disponível"
              value={wallet.availableReais}
              precision={2}
              prefix={<WalletOutlined />}
              formatter={formatBRL}
              styles={{ content: {
                color: wallet.hasNegativeBalance ? "#ff4d4f" : "#3f8600",
              } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Saldo Pendente"
              value={wallet.pendingReais}
              precision={2}
              formatter={formatBRL}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Créditos (período)"
              value={walletData?.periodStats?.creditsReais || 0}
              precision={2}
              prefix={<ArrowUpOutlined />}
              formatter={formatBRL}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Débitos (período)"
              value={walletData?.periodStats?.debitsReais || 0}
              precision={2}
              prefix={<ArrowDownOutlined />}
              formatter={formatBRL}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Botões de ação e filtro */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldValue("type", "credit");
              setAdjustModalOpen(true);
            }}
          >
            Adicionar crédito
          </Button>
          <Button
            danger
            icon={<MinusOutlined />}
            onClick={() => {
              form.setFieldValue("type", "debit");
              setAdjustModalOpen(true);
            }}
          >
            Registrar débito
          </Button>
        </Space>
        <Space>
          <CalendarOutlined />
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            format="DD/MM/YYYY"
            allowClear={false}
            presets={[
              { label: "Últimos 7 dias", value: [dayjs().subtract(7, "day"), dayjs()] },
              { label: "Últimos 30 dias", value: [dayjs().subtract(30, "day"), dayjs()] },
              { label: "Últimos 90 dias", value: [dayjs().subtract(90, "day"), dayjs()] },
              { label: "Este mês", value: [dayjs().startOf("month"), dayjs()] },
              {
                label: "Mês passado",
                value: [
                  dayjs().subtract(1, "month").startOf("month"),
                  dayjs().subtract(1, "month").endOf("month"),
                ],
              },
            ]}
          />
        </Space>
      </div>

      {/* Tabela de transações */}
      <Card
        title={`Transações (${walletData?.total || 0} encontradas)`}
        size="small"
      >
        <Table
          columns={transactionColumns}
          dataSource={walletData?.transactions || []}
          rowKey="id"
          pagination={{
            total: walletData?.total || 0,
            pageSize: walletData?.pageSize || 20,
            current: currentPage,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} transações`,
            onChange: (page) => setCurrentPage(page),
          }}
          locale={{ emptyText: "Nenhuma transação no período selecionado" }}
          size="small"
        />
      </Card>

      {/* Modal de ajuste */}
      <ELModal
        title="Ajustar saldo da carteira"
        open={adjustModalOpen}
        onCancel={() => {
          setAdjustModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        size="sm"
      >
        <Form form={form} layout="vertical" onFinish={handleAdjust}>
          <Form.Item
            name="type"
            label="Tipo de ajuste"
            rules={[{ required: true, message: "Selecione o tipo" }]}
          >
            <Radio.Group>
              <Radio.Button value="credit">
                <PlusOutlined /> Crédito
              </Radio.Button>
              <Radio.Button value="debit">
                <MinusOutlined /> Débito
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Valor (R$)"
            rules={[
              { required: true, message: "Informe o valor" },
              { type: "number", min: 0.01, message: "Valor mínimo: R$ 0,01" },
            ]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              precision={2}
              style={{ width: "100%" }}
              prefix="R$"
              decimalSeparator=","
              formatter={inputNumberFormatterBRL}
              parser={inputNumberParserBRL}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Motivo"
            rules={[
              { required: true, message: "Informe o motivo" },
              { min: 3, message: "Mínimo 3 caracteres" },
            ]}
          >
            <Input.TextArea rows={3} placeholder="Descreva o motivo do ajuste" />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="Este ajuste será registrado na carteira do usuário"
            description={
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) =>
                  getFieldValue("type") === "credit"
                    ? 'O valor será registrado como "Crédito adicionado pela plataforma".'
                    : 'O valor será registrado como "Débito adicionado pela plataforma".'
                }
              </Form.Item>
            }
            style={{ marginBottom: 16 }}
          />

          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setAdjustModalOpen(false);
                  form.resetFields();
                }}
              >
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Confirmar ajuste
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </ELModal>
    </>
  );
}
