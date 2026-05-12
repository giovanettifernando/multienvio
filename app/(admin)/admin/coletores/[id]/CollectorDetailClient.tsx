"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UploadFile } from "antd/es/upload/interface";
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
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  UserOutlined,
  BankOutlined,
  CarOutlined,
  FileTextOutlined,
  DollarOutlined,
  MailOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import { PageShell } from '@/shared/ui/PageShell';
import PFForm from '@/modules/collectors/ui/components/forms/PFForm';
import PJForm from '@/modules/collectors/ui/components/forms/PJForm';
import VehicleForm from '@/modules/collectors/ui/components/forms/VehicleForm';
import DocumentsForm from '@/modules/collectors/ui/components/forms/DocumentsForm';
import FinanceForm from '@/modules/collectors/ui/components/forms/FinanceForm';
import CollectorPickupsTab from '@/modules/admin/ui/components/collectors/CollectorPickupsTab';
import { collectorFormSchema } from "@/modules/collectors/application/schemas";
import { useUpload } from "@/modules/collectors/application/hooks";
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from "@/modules/collectors/application/masks";
import { formatBRL } from "@/shared/utils/format";
import type { Collector, CollectorFormInput, CollectorFormData } from "@/modules/collectors/application/types";

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "blocked", label: "Bloqueado" },
];

async function fetchCollector(id: string): Promise<{ collector: Collector }> {
  const res = await fetch(`/api/admin/coletores/${id}`);
  if (!res.ok) {
    throw new Error("Erro ao carregar dados do coletor");
  }
  const json = await res.json();
  return json.data ?? json;
}

export default function CollectorDetailClient() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const collectorId = params.id as string;
  const upload = useUpload();

  const [statusLoading, setStatusLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cnhFiles, setCnhFiles] = useState<UploadFile[]>([]);
  const [crlvFiles, setCrlvFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "collector", collectorId],
    queryFn: () => fetchCollector(collectorId),
    enabled: !!collectorId,
  });

  const resolver = useMemo(() => zodResolver(collectorFormSchema), []);

  const formMethods = useForm<CollectorFormInput, unknown, CollectorFormData>({
    resolver,
    mode: "onBlur",
  });

  const { handleSubmit, reset, setValue } = formMethods;

  // Preencher formulário quando dados carregarem
  useEffect(() => {
    if (data?.collector) {
      const collector = data.collector;
      reset({
        pf: {
          nome: collector.pf.nome,
          cpf: collector.pf.cpf ? maskCPF(collector.pf.cpf) : "",
          email: collector.pf.email || "",
          cnh: {
            ...collector.pf.cnh,
            category: collector.pf.cnh.category as "ACC" | "A" | "B" | "C" | "D" | "E",
          },
          endereco: {
            cep: collector.pf.endereco.cep ? maskCEP(collector.pf.endereco.cep) : null,
            logradouro: collector.pf.endereco.logradouro,
            numero: collector.pf.endereco.numero,
            complemento: collector.pf.endereco.complemento,
            bairro: collector.pf.endereco.bairro,
            cidade: collector.pf.endereco.cidade,
            uf: collector.pf.endereco.uf,
          },
          celular: collector.pf.celular ? maskPhone(collector.pf.celular) : "",
          whatsapp: collector.pf.whatsapp ? maskPhone(collector.pf.whatsapp) : null,
          usarMesmoNumero: collector.pf.usarMesmoNumero,
        },
        pj: {
          razaoSocial: collector.pj.razaoSocial,
          cnpj: maskCNPJ(collector.pj.cnpj),
          endereco: {
            cep: collector.pj.endereco.cep ? maskCEP(collector.pj.endereco.cep) : null,
            logradouro: collector.pj.endereco.logradouro,
            numero: collector.pj.endereco.numero,
            complemento: collector.pj.endereco.complemento,
            bairro: collector.pj.endereco.bairro,
            cidade: collector.pj.endereco.cidade,
            uf: collector.pj.endereco.uf,
          },
          usarEnderecoFisico: collector.pj.usarEnderecoFisico || false,
        },
        vehicle: {
          plate: collector.vehicle.plate,
          brand: collector.vehicle.brand,
          model: collector.vehicle.model,
          year: collector.vehicle.year,
        },
        documents: collector.documents,
        commission: collector.commission,
        bank: collector.bank,
        pickupFee: {
          minimum: collector.pickupFee?.minimum ?? null,
        },
      });

      setCnhFiles(collector.documents.cnhFiles.map((f) => ({ ...f, status: "done" as const })));
      setCrlvFiles(collector.documents.crlvFile.map((f) => ({ ...f, status: "done" as const })));
      setAddressProofFiles(collector.documents.pfAddressProofFile.map((f) => ({ ...f, status: "done" as const })));
    }
  }, [data, reset]);

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/coletores/${collectorId}/status`, {
        method: "PATCH",
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
      const res = await fetch(`/api/admin/coletores/${collectorId}/reset-password`, {
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

  const handleDeleteCollector = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/coletores/${collectorId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Erro ao excluir coletor");
      }

      message.success("Coletor excluído com sucesso");
      router.push("/admin/coletores");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao excluir coletor");
    } finally {
      setDeleteLoading(false);
    }
  };

  const processUploads = async () => {
    // Process CNH files
    const cnhFileArray: Array<{ uid: string; name: string; url?: string; status?: "uploading" | "done" | "error" }> = [];
    for (const file of cnhFiles) {
      if (file.url) {
        cnhFileArray.push({ uid: file.uid, name: file.name, url: file.url, status: "done" });
      } else if (file.originFileObj) {
        try {
          const url = await upload(file.originFileObj as File);
          cnhFileArray.push({ uid: file.uid, name: file.name, url, status: "done" });
        } catch {
          throw new Error("Erro ao enviar arquivo da CNH");
        }
      }
    }

    // Documentos são opcionais no admin
    // Process CRLV file
    const crlvFile = crlvFiles[0];
    let crlvUrl: string | null = null;
    if (crlvFile?.url) {
      crlvUrl = crlvFile.url;
    } else if (crlvFile?.originFileObj) {
      try {
        crlvUrl = await upload(crlvFile.originFileObj as File);
      } catch {
        throw new Error("Erro ao enviar arquivo do CRLV");
      }
    }

    // Process address proof file
    const addressFile = addressProofFiles[0];
    let addressUrl: string | null = null;
    if (addressFile?.url) {
      addressUrl = addressFile.url;
    } else if (addressFile?.originFileObj) {
      try {
        addressUrl = await upload(addressFile.originFileObj as File);
      } catch {
        throw new Error("Erro ao enviar comprovante de endereço");
      }
    }

    setValue("documents.cnhFiles", cnhFileArray, { shouldValidate: false });
    if (crlvFile) {
      setValue("documents.crlvFile", [{ uid: crlvFile.uid, name: crlvFile.name, url: crlvUrl ?? undefined, status: "done" as const }], { shouldValidate: false });
    }
    if (addressFile) {
      setValue("documents.pfAddressProofFile", [{ uid: addressFile.uid, name: addressFile.name, url: addressUrl ?? undefined, status: "done" as const }], { shouldValidate: false });
    }
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await processUploads();
      await handleSubmit(
        async (formData: CollectorFormData) => {
          const res = await fetch(`/api/admin/coletores/${collectorId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });

          if (!res.ok) {
            const result = await res.json();
            throw new Error(result.message || "Erro ao salvar coletor");
          }

          message.success("Coletor atualizado com sucesso");
          refetch();
        },
        (errors) => {
          console.error("[CollectorDetail] Erros de validação:", JSON.stringify(errors, null, 2));
          const firstMsg = Object.values(errors).flatMap((e: unknown) => {
            const err = e as { message?: string; [key: string]: unknown };
            return err?.message ? [err.message] : Object.values(err ?? {}).map((v: unknown) => (v as { message?: string })?.message).filter(Boolean);
          })[0];
          message.error(firstMsg ? `Erro de validação: ${firstMsg}` : "Preencha todos os campos obrigatórios");
        }
      )();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erro ao salvar coletor");
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

  if (error || !data?.collector) {
    return (
      <PageShell title="Erro" description="">
        <Result
          status="error"
          title="Erro ao carregar dados"
          subTitle="Não foi possível carregar os dados do coletor."
          extra={[
            <Button key="back" onClick={() => router.push("/admin/coletores")}>
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

  const collector = data.collector;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "blocked":
        return "error";
      case "inactive":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "blocked":
        return "Bloqueado";
      case "inactive":
        return "Inativo";
      default:
        return status;
    }
  };

  const getDocumentsStatus = () => {
    const missing: string[] = [];
    if (!collector.documents.cnhFiles || collector.documents.cnhFiles.length === 0) {
      missing.push("CNH");
    }
    if (!collector.documents.crlvFile || collector.documents.crlvFile.length === 0) {
      missing.push("CRLV");
    }
    if (!collector.documents.pfAddressProofFile || collector.documents.pfAddressProofFile.length === 0) {
      missing.push("Comprovante");
    }
    return { ok: missing.length === 0, missing };
  };

  const docsStatus = getDocumentsStatus();

  const formatCommission = () => {
    if (collector.commission.kind === "fixa") {
      return `${formatBRL(collector.commission.amount)}/coleta`;
    }
    return `${formatBRL(collector.commission.amountPerKm)}/km`;
  };

  const tabItems = [
    {
      key: "pf",
      label: (
        <span>
          <UserOutlined /> Pessoa Física
        </span>
      ),
      children: <PFForm />,
    },
    {
      key: "pj",
      label: (
        <span>
          <BankOutlined /> Pessoa Jurídica
        </span>
      ),
      children: <PJForm />,
    },
    {
      key: "vehicle",
      label: (
        <span>
          <CarOutlined /> Veículo
        </span>
      ),
      children: <VehicleForm />,
    },
    {
      key: "documents",
      label: (
        <span>
          <FileTextOutlined /> Documentos
          {!docsStatus.ok && (
            <Tag color="error" style={{ marginLeft: 8 }}>
              Pendentes
            </Tag>
          )}
        </span>
      ),
      children: (
        <DocumentsForm
          cnhFiles={cnhFiles}
          onCnhChange={setCnhFiles}
          crlvFiles={crlvFiles}
          onCrlvChange={setCrlvFiles}
          addressProofFiles={addressProofFiles}
          onAddressProofChange={setAddressProofFiles}
        />
      ),
    },
    {
      key: "finance",
      label: (
        <span>
          <DollarOutlined /> Financeiro
        </span>
      ),
      children: <FinanceForm />,
    },
    {
      key: "pickups",
      label: (
        <span>
          <ShoppingOutlined /> Coletas
        </span>
      ),
      children: <CollectorPickupsTab collectorId={collectorId} />,
    },
  ];

  return (
    <PageShell
      title=""
      description=""
      extra={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/coletores")}
        >
          Voltar para lista
        </Button>
      }
    >
      <FormProvider {...formMethods}>
        <Row gutter={16}>
          {/* Sidebar - Collector Info */}
          <Col xs={24} lg={6}>
            <Card style={{ marginBottom: 16, textAlign: "center" }}>
              <Avatar
                size={100}
                icon={<UserOutlined />}
                style={{ backgroundColor: "#1890ff", marginBottom: 16 }}
              />
              <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                {collector.pf.nome}
              </Title>
              <Space wrap style={{ justifyContent: "center", marginBottom: 12 }}>
                <Tag color={getStatusColor(collector.status)}>
                  {getStatusLabel(collector.status)}
                </Tag>
                <Tooltip title={docsStatus.ok ? "Documentos OK" : `Faltando: ${docsStatus.missing.join(", ")}`}>
                  <Tag color={docsStatus.ok ? "success" : "error"} icon={docsStatus.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                    Docs {docsStatus.ok ? "OK" : "Pendentes"}
                  </Tag>
                </Tooltip>
              </Space>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ display: "block" }}>
                  {collector.pf.email}
                </Text>
                {collector.pf.celular && (
                  <Text type="secondary" style={{ display: "block" }}>
                    {maskPhone(collector.pf.celular)}
                  </Text>
                )}
              </div>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="CNPJ">
                  {maskCNPJ(collector.pj.cnpj)}
                </Descriptions.Item>
                <Descriptions.Item label="Veículo">
                  <strong>{collector.vehicle.plate}</strong>
                  {collector.vehicle.model && (
                    <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                      {collector.vehicle.brand} {collector.vehicle.model}
                    </Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Comissão">
                  <strong>{formatCommission()}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Cidade">
                  {collector.pj.endereco.cidade && collector.pj.endereco.uf
                    ? `${collector.pj.endereco.cidade}/${collector.pj.endereco.uf}`
                    : "—"}
                </Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: "16px 0" }} />

              {/* Status Select */}
              <div style={{ marginBottom: 16, textAlign: "left" }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Status da conta
                </Text>
                <Select
                  value={collector.status}
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

              {/* Delete Collector Button */}
              <Popconfirm
                title="Excluir coletor"
                description="Tem certeza que deseja excluir este coletor? Esta ação não pode ser desfeita."
                onConfirm={handleDeleteCollector}
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
                  Excluir coletor
                </Button>
              </Popconfirm>
            </Card>
          </Col>

          {/* Main Content - Tabs */}
          <Col xs={24} lg={18}>
            <Card>
              <Spin spinning={saveLoading}>
                <Tabs items={tabItems} defaultActiveKey="pf" className="collector-detail-tabs" />
                <Divider />
                <div style={{ textAlign: "right" }}>
                  <Button
                    type="primary"
                    onClick={handleSave}
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
      </FormProvider>
    </PageShell>
  );
}
