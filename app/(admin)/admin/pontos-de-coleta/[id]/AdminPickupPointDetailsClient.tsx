"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Row,
  Col,
  Space,
  Select,
  Divider,
  App,
  Popconfirm,
  Form,
  Input,
  InputNumber,
  Radio,
} from "antd";
import {
  ArrowLeftOutlined,
  ShopOutlined,
  BankOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  MailOutlined,
  DeleteOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { PageShell } from "@/components/shared/PageShell";
import { pickupPointSchema } from "@/lib/pickup/schemas";
import { maskCNPJ, maskCEP, maskPhone, maskCPF, unmaskDigits } from "@/lib/pickup/masks";
import { formatBRL, inputNumberFormatterBRL, inputNumberParserBRL } from "@/lib/utils/format";
import type { PickupPoint, PickupPointFormData } from "@/lib/pickup/types";
import PickupPointReceptionsTab from "@/components/admin/pickup-points/PickupPointReceptionsTab";

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

async function fetchPickupPoint(id: string): Promise<{ point: PickupPoint }> {
  const res = await fetch(`/api/admin/pickup-points/${id}`);
  if (!res.ok) {
    throw new Error("Erro ao carregar dados do ponto de coleta");
  }
  return res.json();
}

export default function AdminPickupPointDetailsClient() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const pointId = params.id as string;

  const [statusLoading, setStatusLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "pickup-point", pointId],
    queryFn: () => fetchPickupPoint(pointId),
    enabled: !!pointId,
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PickupPointFormData>({
    resolver: zodResolver(pickupPointSchema),
  });

  const paymentMethod = watch("paymentMethod");
  const paymentKind = paymentMethod?.kind || "pix";

  // Preencher formulário quando dados carregarem
  useEffect(() => {
    if (data?.point) {
      const point = data.point;
      reset({
        razaoSocial: point.razaoSocial,
        nomeFantasia: point.nomeFantasia,
        cnpj: maskCNPJ(point.cnpj),
        ie: point.ie || "",
        email: point.email || "",
        telefone: point.telefone || "",
        cep: point.cep ? maskCEP(point.cep) : "",
        logradouro: point.logradouro || "",
        numero: point.numero || "",
        complemento: point.complemento || "",
        bairro: point.bairro || "",
        cidade: point.cidade || "",
        uf: point.uf || "",
        geo: point.geo || null,
        paymentMethod: point.paymentMethod,
        payoutDay: point.payoutDay || undefined,
        minPayoutAmount: point.minPayoutAmount || undefined,
        commissionPerItem: point.commissionPerItem ?? null,
        capacityPerDay: point.capacityPerDay ?? null,
      });
    }
  }, [data, reset]);

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/pickup-points/${pointId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Erro ao alterar status");
      }

      message.success("Status alterado com sucesso");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao alterar status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSendResetPassword = async () => {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/pickup-points/${pointId}/reset-password`, {
        method: "POST",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Erro ao enviar email");
      }

      message.success(result.message || "Email de redefinição enviado");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeletePoint = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/pickup-points/${pointId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Erro ao excluir ponto");
      }

      message.success("Ponto de coleta excluído com sucesso");
      router.push("/admin/pontos-de-coleta");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao excluir ponto");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSave = async (formData: PickupPointFormData) => {
    setSaveLoading(true);
    try {
      // Unmask fields before submission
      const processedData = {
        ...formData,
        cnpj: unmaskDigits(formData.cnpj),
        cep: formData.cep ? unmaskDigits(formData.cep) : undefined,
        telefone: formData.telefone ? unmaskDigits(formData.telefone) : undefined,
      };

      // Unmask payment method fields if needed
      if (processedData.paymentMethod.kind === "pix") {
        if (processedData.paymentMethod.pixType === "cpf" || processedData.paymentMethod.pixType === "cnpj") {
          processedData.paymentMethod.pixKey = unmaskDigits(processedData.paymentMethod.pixKey);
        }
      } else if (processedData.paymentMethod.kind === "transfer") {
        processedData.paymentMethod.holderDocument = unmaskDigits(processedData.paymentMethod.holderDocument);
      }

      const res = await fetch(`/api/admin/pickup-points/${pointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processedData),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Erro ao salvar ponto");
      }

      message.success("Ponto de coleta atualizado com sucesso");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao salvar ponto");
    } finally {
      setSaveLoading(false);
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

  if (error || !data?.point) {
    return (
      <PageShell title="Erro" description="">
        <Result
          status="error"
          title="Erro ao carregar dados"
          subTitle="Não foi possível carregar os dados do ponto de coleta."
          extra={[
            <Button key="back" onClick={() => router.push("/admin/pontos-de-coleta")}>
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

  const point = data.point;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "BLOCKED":
        return "error";
      case "PENDING":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Ativo";
      case "BLOCKED":
        return "Bloqueado";
      case "PENDING":
        return "Pendente";
      default:
        return status;
    }
  };

  const tabItems = [
    {
      key: "empresa",
      label: (
        <span>
          <ShopOutlined /> Empresa
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Form layout="vertical">
            <Form.Item
              label="Razão Social"
              required
              validateStatus={errors.razaoSocial ? "error" : ""}
              help={errors.razaoSocial?.message}
            >
              <Controller
                name="razaoSocial"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
            </Form.Item>

            <Form.Item
              label="Nome Fantasia"
              required
              validateStatus={errors.nomeFantasia ? "error" : ""}
              help={errors.nomeFantasia?.message}
            >
              <Controller
                name="nomeFantasia"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
            </Form.Item>

            <Form.Item
              label="CNPJ"
              required
              validateStatus={errors.cnpj ? "error" : ""}
              help={errors.cnpj?.message}
            >
              <Controller
                name="cnpj"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    maxLength={18}
                    onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Inscrição Estadual" help="Opcional">
              <Controller
                name="ie"
                control={control}
                render={({ field }) => <Input {...field} value={field.value || ""} />}
              />
            </Form.Item>

            <Form.Item label="E-mail">
              <Controller
                name="email"
                control={control}
                render={({ field }) => <Input {...field} value={field.value || ""} type="email" />}
              />
            </Form.Item>

            <Form.Item label="Telefone">
              <Controller
                name="telefone"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ""}
                    maxLength={15}
                    onChange={(e) => field.onChange(unmaskDigits(e.target.value))}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Nova Senha" help="Deixe em branco para manter a senha atual">
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password {...field} value={field.value || ""} placeholder="Mínimo 6 caracteres" />
                )}
              />
            </Form.Item>

            <Form.Item label="Capacidade (pedidos/dia)" help="0 = sem limite">
              <Controller
                name="capacityPerDay"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange(value ?? null)}
                    min={0}
                    precision={0}
                    style={{ width: "100%" }}
                  />
                )}
              />
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: "endereco",
      label: (
        <span>
          <EnvironmentOutlined /> Endereço
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Form layout="vertical">
            <Form.Item label="CEP">
              <Controller
                name="cep"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ""}
                    maxLength={9}
                    style={{ width: 160 }}
                    onChange={(e) => field.onChange(maskCEP(unmaskDigits(e.target.value)))}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Logradouro">
              <Controller
                name="logradouro"
                control={control}
                render={({ field }) => <Input {...field} value={field.value || ""} />}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Número">
                  <Controller
                    name="numero"
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value || ""} />}
                  />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="Complemento">
                  <Controller
                    name="complemento"
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value || ""} />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Bairro">
              <Controller
                name="bairro"
                control={control}
                render={({ field }) => <Input {...field} value={field.value || ""} />}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label="Cidade">
                  <Controller
                    name="cidade"
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value || ""} />}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="UF">
                  <Controller
                    name="uf"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        value={field.value || undefined}
                        showSearch
                        allowClear
                        options={UFS.map((uf) => ({ label: uf, value: uf }))}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ),
    },
    {
      key: "pagamento",
      label: (
        <span>
          <DollarOutlined /> Pagamento
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Form layout="vertical">
            <Form.Item label="Método de Pagamento" required>
              <Controller
                name="paymentMethod.kind"
                control={control}
                render={({ field }) => (
                  <Radio.Group {...field} buttonStyle="solid">
                    <Radio.Button value="pix">PIX</Radio.Button>
                    <Radio.Button value="transfer">Transferência Bancária</Radio.Button>
                  </Radio.Group>
                )}
              />
            </Form.Item>

            {paymentKind === "pix" && (
              <>
                <Form.Item label="Tipo de Chave PIX" required>
                  <Controller
                    name="paymentMethod.pixType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={[
                          { label: "CPF", value: "cpf" },
                          { label: "CNPJ", value: "cnpj" },
                          { label: "E-mail", value: "email" },
                          { label: "Telefone", value: "phone" },
                          { label: "Chave Aleatória", value: "random" },
                        ]}
                      />
                    )}
                  />
                </Form.Item>

                <Form.Item label="Chave PIX" required>
                  <Controller
                    name="paymentMethod.pixKey"
                    control={control}
                    render={({ field }) => {
                      const pixType = watch("paymentMethod.pixType");
                      return (
                        <Input
                          {...field}
                          onChange={(e) => {
                            let value = e.target.value;
                            if (pixType === "cpf") value = maskCPF(value);
                            else if (pixType === "cnpj") value = maskCNPJ(value);
                            else if (pixType === "phone") value = unmaskDigits(value);
                            field.onChange(value);
                          }}
                        />
                      );
                    }}
                  />
                </Form.Item>
              </>
            )}

            {paymentKind === "transfer" && (
              <>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Código do Banco" required>
                      <Controller
                        name="paymentMethod.bankCode"
                        control={control}
                        render={({ field }) => <Input {...field} maxLength={8} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Agência" required>
                      <Controller
                        name="paymentMethod.branch"
                        control={control}
                        render={({ field }) => <Input {...field} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Tipo de Conta" required>
                      <Controller
                        name="paymentMethod.accountType"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={[
                              { label: "Corrente", value: "corrente" },
                              { label: "Poupança", value: "poupanca" },
                            ]}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Conta" required>
                  <Controller
                    name="paymentMethod.account"
                    control={control}
                    render={({ field }) => <Input {...field} />}
                  />
                </Form.Item>

                <Form.Item label="Nome do Titular" required>
                  <Controller
                    name="paymentMethod.holderName"
                    control={control}
                    render={({ field }) => <Input {...field} />}
                  />
                </Form.Item>

                <Form.Item label="CNPJ do Titular" required>
                  <Controller
                    name="paymentMethod.holderDocument"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        maxLength={18}
                        onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                      />
                    )}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label="Dia do Repasse" help="Entre 1 e 28 (opcional)">
              <Controller
                name="payoutDay"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    value={field.value ?? undefined}
                    min={1}
                    max={28}
                    style={{ width: 100 }}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Valor Mínimo para Repasse" help="Valor mínimo em R$ (opcional)">
              <Controller
                name="minPayoutAmount"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    value={field.value ?? undefined}
                    min={0}
                    style={{ width: 160 }}
                    prefix="R$"
                    precision={2}
                    decimalSeparator=","
                    formatter={inputNumberFormatterBRL}
                    parser={inputNumberParserBRL}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Comissão por Item Recebido" help="Valor pago por cada item recebido neste ponto">
              <Controller
                name="commissionPerItem"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    value={field.value ?? undefined}
                    onChange={(value) => field.onChange(value ?? null)}
                    min={0}
                    step={0.01}
                    style={{ width: 160 }}
                    prefix="R$"
                    precision={2}
                    decimalSeparator=","
                    formatter={inputNumberFormatterBRL}
                    parser={inputNumberParserBRL}
                  />
                )}
              />
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: "receptions",
      label: (
        <span>
          <InboxOutlined /> Recepções
        </span>
      ),
      children: <PickupPointReceptionsTab pointId={pointId} />,
    },
  ];

  return (
    <PageShell
      title=""
      description=""
      extra={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/pontos-de-coleta")}
        >
          Voltar para lista
        </Button>
      }
    >
      <Row gutter={16}>
        {/* Sidebar - Point Info */}
        <Col xs={24} lg={6}>
          <Card style={{ marginBottom: 16, textAlign: "center" }}>
            <Avatar
              size={100}
              icon={<ShopOutlined />}
              style={{ backgroundColor: "#722ed1", marginBottom: 16 }}
            />
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              {point.nomeFantasia}
            </Title>
            <Space wrap style={{ justifyContent: "center", marginBottom: 12 }}>
              <Tag color={getStatusColor(point.status)}>
                {getStatusLabel(point.status)}
              </Tag>
            </Space>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: "block" }}>
                {point.email || "Sem email"}
              </Text>
              {point.telefone && (
                <Text type="secondary" style={{ display: "block" }}>
                  {maskPhone(point.telefone)}
                </Text>
              )}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="CNPJ">
                {maskCNPJ(point.cnpj)}
              </Descriptions.Item>
              <Descriptions.Item label="Cidade">
                {point.cidade && point.uf ? `${point.cidade}/${point.uf}` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Capacidade/dia">
                {point.capacityPerDay || "Ilimitado"}
              </Descriptions.Item>
              <Descriptions.Item label="Comissão/item">
                <strong style={{ color: "#52c41a" }}>
                  {point.commissionPerItem ? formatBRL(point.commissionPerItem) : "—"}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Recebidos no mês">
                <strong>{point.monthlyReceived || 0}</strong>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: "16px 0" }} />

            {/* Status Select */}
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Status da conta
              </Text>
              <Select
                value={point.status}
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
              style={{ marginBottom: 8 }}
            >
              Enviar redefinição de senha
            </Button>

            {/* Delete Point Button */}
            <Popconfirm
              title="Excluir ponto de coleta"
              description="Tem certeza que deseja excluir este ponto? Esta ação não pode ser desfeita."
              onConfirm={handleDeletePoint}
              okText="Sim, excluir"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button
                icon={<DeleteOutlined />}
                danger
                loading={deleteLoading}
                block
              >
                Excluir ponto
              </Button>
            </Popconfirm>
          </Card>
        </Col>

        {/* Main Content - Tabs */}
        <Col xs={24} lg={18}>
          <Card>
            <Spin spinning={saveLoading}>
              <Tabs items={tabItems} defaultActiveKey="empresa" />
              <Divider />
              <div style={{ textAlign: "right" }}>
                <Button
                  type="primary"
                  onClick={handleSubmit(handleSave)}
                  loading={saveLoading}
                  size="large"
                >
                  Salvar alterações
                </Button>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>
    </PageShell>
  );
}
