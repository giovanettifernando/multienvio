"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  AppstoreOutlined,
  DownloadOutlined,
  GiftOutlined,
  InboxOutlined,
  MailOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Slider,
  Space,
  Typography,
  message,
} from "antd";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CompanyWizardData } from "@/lib/validation/company";
import {
  quoteSchema,
  transportadoraEnum,
  type OrigemDestinoInput,
  type PacoteQuoteInput,
  type PreferenciasQuoteInput,
} from "@/lib/validation/quote";
import { normalizeCEPInput } from "@/lib/masks";
import { QuoteSummary } from "@/components/ui/QuoteSummary";
import {
  QuoteResultCard,
  type QuoteResult,
} from "@/components/ui/QuoteResultCard";
import { generateMockQuotes } from "@/mocks/quotes";

type QuoteValues = z.infer<typeof quoteSchema>;

type QuoteSnapshot = {
  id: string;
  createdAt: string;
  origemDestino: OrigemDestinoInput;
  pacote: PacoteQuoteInput;
  preferencias: PreferenciasQuoteInput;
  resultados: QuoteResult[];
};

type QuoteFormProps = {
  company: CompanyWizardData;
};

type CepResponse =
  | {
      found: true;
      cep: string;
      logradouro: string;
      bairro: string;
      cidade: string;
      uf: string;
    }
  | { found: false; mensagem?: string };

const categoriaOptions = [
  "Eletrônicos",
  "Documentos",
  "Roupas",
  "Cosméticos",
  "Outros",
].map((value) => ({ label: value, value }));

const pacoteTypes: Array<{
  key: "envelope" | "caixaP" | "caixaM" | "personalizado";
  label: string;
  icon: ReactNode;
  preset?: Partial<PacoteQuoteInput>;
}> = [
  {
    key: "envelope",
    label: "Envelope",
    icon: <MailOutlined />,
    preset: {
      pesoKg: 0.3,
      comprimentoCm: 30,
      larguraCm: 22,
      alturaCm: 2,
      valorDeclarado: 50,
      categoria: "Documentos",
    },
  },
  {
    key: "caixaP",
    label: "Caixa P",
    icon: <InboxOutlined />,
    preset: {
      pesoKg: 1.2,
      comprimentoCm: 30,
      larguraCm: 20,
      alturaCm: 15,
      valorDeclarado: 250,
      categoria: "Eletrônicos",
    },
  },
  {
    key: "caixaM",
    label: "Caixa M",
    icon: <GiftOutlined />,
    preset: {
      pesoKg: 4,
      comprimentoCm: 40,
      larguraCm: 30,
      alturaCm: 25,
      valorDeclarado: 480,
      categoria: "Roupas",
    },
  },
  {
    key: "personalizado",
    label: "Personalizado",
    icon: <AppstoreOutlined />,
  },
];

async function lookupCep(cep: string): Promise<CepResponse> {
  const response = await fetch(`/api/cep?cep=${cep}`);
  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP");
  }
  return response.json();
}

export function QuoteForm({ company }: QuoteFormProps) {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const companyCep = normalizeCEPInput(company.endereco.cep ?? "");
  const companyCidade = company.endereco.cidade ?? "";
  const companyUf = company.endereco.uf ?? "";

  const [cepOrigemLoading, setCepOrigemLoading] = useState(false);
  const [cepDestinoLoading, setCepDestinoLoading] = useState(false);
  const [lastOrigemCep, setLastOrigemCep] = useState<string | null>(
    companyCep || null,
  );
  const [lastDestinoCep, setLastDestinoCep] = useState<string | null>(null);
  const [results, setResults] = useState<QuoteResult[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null);
  const [selectedPackageType, setSelectedPackageType] =
    useState<"envelope" | "caixaP" | "caixaM" | "personalizado">("caixaP");
  const [sortKey, setSortKey] = useState<"price" | "eta" | "carrier">("price");
  const [sortLocked, setSortLocked] = useState(false);
  const [origemInfo, setOrigemInfo] = useState<{
    logradouro?: string;
    bairro?: string;
    cidade: string;
    uf: string;
  } | null>(
    companyCidade && companyUf
      ? {
          logradouro: company.endereco.logradouro ?? undefined,
          bairro: company.endereco.bairro ?? undefined,
          cidade: companyCidade,
          uf: companyUf,
        }
      : null,
  );
  const [destinoInfo, setDestinoInfo] = useState<
    { logradouro: string; bairro: string; cidade: string; uf: string } | null
  >(null);

  const defaultValues = useMemo<QuoteValues>(
    () => ({
      origemDestino: {
        cepOrigem: companyCep,
        cepDestino: "",
        coleta: false,
        portaAPorta: false,
      },
      pacote: {
        pesoKg: 1.2,
        valorDeclarado: 250,
        comprimentoCm: 30,
        larguraCm: 20,
        alturaCm: 15,
        categoria: "Eletrônicos",
      },
      preferencias: {
        prioridade: 30,
        adicionais: {
          seguro: false,
          avisoRecebimento: false,
          maoPropria: false,
        },
        transportadoras: transportadoraEnum.options,
        usarTabelaContratada: false,
      },
    }),
    [companyCep],
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<QuoteValues>({
    resolver: zodResolver(quoteSchema) as Resolver<QuoteValues>,
    defaultValues,
  });

  const origemDestinoValues = watch("origemDestino");
  const pacoteValues = watch("pacote");
  const preferenciasValues = watch("preferencias");
  const prioridadeValue = preferenciasValues.prioridade ?? 0;
  const cepOrigem = origemDestinoValues.cepOrigem;
  const cepDestino = origemDestinoValues.cepDestino;

  useEffect(() => {
    if (sortLocked) return;
    setSortKey(prioridadeValue >= 60 ? "eta" : "price");
  }, [prioridadeValue, sortLocked]);

  useEffect(() => {
    if (!cepOrigem) {
      setOrigemInfo(null);
      return;
    }
    const normalized = normalizeCEPInput(cepOrigem);
    if (normalized.length < 9) {
      setOrigemInfo(null);
      return;
    }
    if (normalized === lastOrigemCep) return;
    setCepOrigemLoading(true);
    lookupCep(normalized)
      .then((data) => {
        if (!data.found) {
          messageApi.warning(data.mensagem ?? "CEP de origem não encontrado");
          setLastOrigemCep(normalized);
          setOrigemInfo(null);
          return;
        }
        setValue("origemDestino.cepOrigem", data.cep, {
          shouldDirty: true,
        });
        setOrigemInfo({
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.cidade,
          uf: data.uf,
        });
        setLastOrigemCep(data.cep);
      })
      .catch(() => {
        messageApi.error("Não foi possível consultar o CEP");
      })
      .finally(() => setCepOrigemLoading(false));
  }, [cepOrigem, lastOrigemCep, messageApi, setValue]);

  useEffect(() => {
    if (!cepDestino) {
      setDestinoInfo(null);
      return;
    }
    const normalized = normalizeCEPInput(cepDestino);
    if (normalized.length < 9) {
      setDestinoInfo(null);
      return;
    }
    if (normalized === lastDestinoCep) return;
    setCepDestinoLoading(true);
    lookupCep(normalized)
      .then((data) => {
        if (!data.found) {
          messageApi.warning(data.mensagem ?? "CEP de destino não encontrado");
          setLastDestinoCep(normalized);
          setDestinoInfo(null);
          return;
        }
        setValue("origemDestino.cepDestino", data.cep, {
          shouldDirty: true,
        });
        setDestinoInfo({
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.cidade,
          uf: data.uf,
        });
        setLastDestinoCep(data.cep);
      })
      .catch(() => {
        messageApi.error("Não foi possível consultar o CEP");
      })
      .finally(() => setCepDestinoLoading(false));
  }, [cepDestino, lastDestinoCep, messageApi, setValue]);

  const cotarMutation = useMutation<QuoteResult[], Error, QuoteValues>({
    mutationFn: async (payload) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return generateMockQuotes({
        pacote: payload.pacote,
        preferencias: payload.preferencias,
      });
    },
    onSuccess: (data) => {
      const generatedId = nanoid();
      setResults(data);
      setQuoteId(generatedId);

      const current = getValues();
      setSnapshot({
        id: generatedId,
        createdAt: new Date().toISOString(),
        origemDestino: current.origemDestino,
        pacote: current.pacote,
        preferencias: current.preferencias,
        resultados: data,
      });

      messageApi.success("Cotação gerada com sucesso!");
    },
    onError: (err) => {
      const texto =
        err instanceof Error
          ? err.message
          : "Não foi possível calcular a cotação";
      messageApi.error(texto);
    },
  });

  const pesoCubado = useMemo(() => {
    const volume =
      pacoteValues.comprimentoCm *
      pacoteValues.larguraCm *
      pacoteValues.alturaCm;
    return volume / 6000;
  }, [
    pacoteValues.alturaCm,
    pacoteValues.comprimentoCm,
    pacoteValues.larguraCm,
  ]);

  const sortedResults = useMemo(() => {
    const items = [...results];
    if (sortKey === "eta") {
      return items.sort((a, b) => a.etaDays - b.etaDays);
    }
    if (sortKey === "carrier") {
      return items.sort((a, b) => a.carrier.localeCompare(b.carrier, "pt-BR"));
    }
    return items.sort((a, b) => a.price - b.price);
  }, [results, sortKey]);

  const handlePreset = (
    key: "envelope" | "caixaP" | "caixaM" | "personalizado",
  ) => {
    setSelectedPackageType(key);
    const selected = pacoteTypes.find((preset) => preset.key === key);
    if (!selected?.preset) return;

    (Object.keys(selected.preset) as (keyof PacoteQuoteInput)[]).forEach(
      (fieldKey) => {
        const path = `pacote.${String(fieldKey)}` as Path<QuoteValues>;
        setValue(path, selected.preset?.[fieldKey] as unknown as never, {
          shouldDirty: true,
        });
      },
    );
  };

  const handleExportCsv = () => {
    if (!results.length) {
      messageApi.warning("Realize uma cotação para exportar");
      return;
    }
    const header = ["transportadora", "servico", "prazo_dias", "preco"];
    const lines = results.map((result) =>
      [
        result.carrier,
        result.name,
        String(result.etaDays),
        result.price.toFixed(2).replace(".", ","),
      ].join(";"),
    );
    const csvContent = [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cotacao_${quoteId ?? "atual"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveQuote = () => {
    if (!quoteId || !snapshot) {
      messageApi.warning("Nenhuma cotação para salvar");
      return;
    }
    const storageKey = "enviolegal:quotes";
    const stored = typeof window !== "undefined"
      ? localStorage.getItem(storageKey)
      : null;
    const list = stored ? (JSON.parse(stored) as QuoteSnapshot[]) : [];
    const updated = [snapshot, ...list.filter((item) => item.id !== quoteId)].slice(
      0,
      10,
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    messageApi.success("Cotação salva");
  };

  const handleResultDetails = (result: QuoteResult) => {
    Modal.info({
      width: 420,
      title: `${result.carrier} - ${result.name}`,
      content: (
        <Space direction="vertical" style={{ marginTop: 12, width: "100%" }}>
          <Typography.Text>
            Prazo estimado: {result.etaDays} dias úteis
          </Typography.Text>
          <Typography.Text>
            Entrega prevista até {" "}
            {new Date(result.estimatedDelivery).toLocaleDateString("pt-BR")}
          </Typography.Text>
          <Typography.Text strong>Detalhamento</Typography.Text>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              Base: {" "}
              {result.breakdown.base.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </li>
            {result.breakdown.adjustments.map((item) => (
              <li key={item.label}>
                {item.label}: {" "}
                {item.value.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </li>
            ))}
          </ul>
        </Space>
      ),
      okText: "Fechar",
    });
  };

  const handleGenerateLabel = (result: QuoteResult) => {
    if (!quoteId) {
      messageApi.warning("Realize uma cotação antes de gerar a etiqueta");
      return;
    }
    router.push(
      `/etiquetas?cotacaoId=${quoteId}&serviceCode=${result.serviceCode}`,
    );
  };

  const onSubmit = (values: QuoteValues) => {
    cotarMutation.mutate(values);
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {contextHolder}

      <Flex align="start" gap={24} wrap>
        <Space
          direction="vertical"
          size={24}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit(onSubmit)}
          >
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              <Card title="Remetente e Destino">
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Flex gap={16} wrap>
                    <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 220 }}>
                      <Controller
                        name="origemDestino.cepOrigem"
                        control={control}
                        render={({ field }) => (
                          <Form.Item
                            label="CEP de Origem"
                            required
                            validateStatus={
                              errors.origemDestino?.cepOrigem
                                ? "error"
                                : cepOrigemLoading
                                ? "validating"
                                : ""
                            }
                            help={
                              errors.origemDestino?.cepOrigem?.message ??
                              (cepOrigemLoading ? "Consultando CEP..." : undefined)
                            }
                          >
                            <Input
                              {...field}
                              value={normalizeCEPInput(field.value)}
                              onChange={(event) =>
                                field.onChange(
                                  normalizeCEPInput(event.target.value),
                                )
                              }
                              placeholder="00000-000"
                              maxLength={9}
                              aria-invalid={Boolean(
                                errors.origemDestino?.cepOrigem,
                              )}
                            />
                          </Form.Item>
                        )}
                      />
                      <Typography.Text type="secondary">
                        {cepOrigemLoading
                          ? "Consultando CEP..."
                          : origemInfo
                          ? `${origemInfo.cidade} - ${origemInfo.uf}`
                          : "Preenchido automaticamente após consultar o CEP"}
                      </Typography.Text>
                    </Space>

                    <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 220 }}>
                      <Controller
                        name="origemDestino.cepDestino"
                        control={control}
                        render={({ field }) => (
                          <Form.Item
                            label="CEP de Destino"
                            required
                            validateStatus={
                              errors.origemDestino?.cepDestino
                                ? "error"
                                : cepDestinoLoading
                                ? "validating"
                                : ""
                            }
                            help={
                              errors.origemDestino?.cepDestino?.message ??
                              (cepDestinoLoading ? "Consultando CEP..." : undefined)
                            }
                          >
                            <Input
                              {...field}
                              id="cepDestinoInput"
                              value={normalizeCEPInput(field.value)}
                              onChange={(event) =>
                                field.onChange(
                                  normalizeCEPInput(event.target.value),
                                )
                              }
                              placeholder="00000-000"
                              maxLength={9}
                              aria-invalid={Boolean(
                                errors.origemDestino?.cepDestino,
                              )}
                            />
                          </Form.Item>
                        )}
                      />
                      <Typography.Text type="secondary">
                        {cepDestinoLoading
                          ? "Consultando CEP..."
                          : destinoInfo
                          ? `${destinoInfo.cidade} - ${destinoInfo.uf}`
                          : "Preenchido automaticamente após consultar o CEP"}
                      </Typography.Text>
                    </Space>
                  </Flex>

                  <Flex gap={12} wrap>
                    <Controller
                      name="origemDestino.coleta"
                      control={control}
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value}>
                          Retirar no endereço (coleta)
                        </Checkbox>
                      )}
                    />
                    <Controller
                      name="origemDestino.portaAPorta"
                      control={control}
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value}>
                          Entrega porta a porta
                        </Checkbox>
                      )}
                    />
                  </Flex>
                </Space>
              </Card>

              <Card title="Pacote">
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <div>
                    <Typography.Text strong>Tipo de pacote</Typography.Text>
                  </div>
                  <Radio.Group
                    value={selectedPackageType}
                    onChange={(event) =>
                      handlePreset(
                        event.target.value as "envelope" | "caixaP" | "caixaM" | "personalizado",
                      )
                    }
                  >
                    <Space wrap size={12}>
                      {pacoteTypes.map((type) => (
                        <Radio.Button key={type.key} value={type.key}>
                          <Space align="center" size={8}>
                            {type.icon}
                            {type.label}
                          </Space>
                        </Radio.Button>
                      ))}
                    </Space>
                  </Radio.Group>

                  <Flex gap={16} wrap>
                    <Controller
                      name="pacote.pesoKg"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Peso (kg)"
                          required
                          style={{ flex: 1, minWidth: 140 }}
                          validateStatus={
                            errors.pacote?.pesoKg ? "error" : ""
                          }
                          help={errors.pacote?.pesoKg?.message}
                        >
                          <InputNumber
                            {...field}
                            style={{ width: "100%" }}
                            min={0.1}
                            step={0.1}
                          />
                        </Form.Item>
                      )}
                    />
                    <Controller
                      name="pacote.valorDeclarado"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Valor declarado (R$)"
                          required
                          style={{ flex: 1, minWidth: 160 }}
                          validateStatus={
                            errors.pacote?.valorDeclarado ? "error" : ""
                          }
                          help={errors.pacote?.valorDeclarado?.message}
                        >
                          <InputNumber
                            {...field}
                            style={{ width: "100%" }}
                            min={0}
                            step={10}
                          />
                        </Form.Item>
                      )}
                    />
                  </Flex>

                  <div>
                    <Typography.Text strong>
                      Dimensões (C × L × A cm)
                    </Typography.Text>
                  </div>
                  <Flex gap={16} wrap>
                    <Controller
                      name="pacote.comprimentoCm"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Comprimento"
                          required
                          style={{ flex: 1, minWidth: 140 }}
                          validateStatus={
                            errors.pacote?.comprimentoCm ? "error" : ""
                          }
                          help={errors.pacote?.comprimentoCm?.message}
                        >
                          <InputNumber
                            {...field}
                            style={{ width: "100%" }}
                            min={16}
                            step={1}
                          />
                        </Form.Item>
                      )}
                    />
                    <Controller
                      name="pacote.larguraCm"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Largura"
                          required
                          style={{ flex: 1, minWidth: 140 }}
                          validateStatus={
                            errors.pacote?.larguraCm ? "error" : ""
                          }
                          help={errors.pacote?.larguraCm?.message}
                        >
                          <InputNumber
                            {...field}
                            style={{ width: "100%" }}
                            min={11}
                            step={1}
                          />
                        </Form.Item>
                      )}
                    />
                    <Controller
                      name="pacote.alturaCm"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Altura"
                          required
                          style={{ flex: 1, minWidth: 140 }}
                          validateStatus={
                            errors.pacote?.alturaCm ? "error" : ""
                          }
                          help={errors.pacote?.alturaCm?.message}
                        >
                          <InputNumber
                            {...field}
                            style={{ width: "100%" }}
                            min={2}
                            step={1}
                          />
                        </Form.Item>
                      )}
                    />
                  </Flex>

                  <Typography.Text type="secondary">
                    Peso cubado: {pesoCubado.toFixed(2)} kg
                  </Typography.Text>

                  <Controller
                    name="pacote.categoria"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="Categoria"
                        required
                        style={{ maxWidth: 260 }}
                        validateStatus={
                          errors.pacote?.categoria ? "error" : ""
                        }
                        help={errors.pacote?.categoria?.message}
                      >
                        <Select
                          {...field}
                          options={categoriaOptions}
                          placeholder="Selecione a categoria"
                        />
                      </Form.Item>
                    )}
                  />
                </Space>
              </Card>

              <Card title="Preferências">
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Controller
                    name="preferencias.prioridade"
                    control={control}
                    render={({ field }) => (
                      <Form.Item label="Prioridade">
                        <Slider
                          {...field}
                          marks={{ 0: "Mais barato", 100: "Mais rápido" }}
                          tooltip={{ formatter: undefined }}
                        />
                      </Form.Item>
                    )}
                  />

                  <Space direction="vertical" size={8}>
                    <Typography.Text strong>Serviços adicionais</Typography.Text>
                    <Controller
                      name="preferencias.adicionais.seguro"
                      control={control}
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value}>
                          Seguro adicional
                        </Checkbox>
                      )}
                    />
                    <Controller
                      name="preferencias.adicionais.avisoRecebimento"
                      control={control}
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value}>
                          Aviso de recebimento
                        </Checkbox>
                      )}
                    />
                  </Space>
                </Space>
              </Card>

              <Card title="Ações">
                <Flex gap={12} wrap>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={cotarMutation.isPending}
                  >
                    Cotar agora
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportCsv}
                    disabled={!results.length}
                    aria-label="Exportar cotações em CSV"
                  >
                    Exportar CSV
                  </Button>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={handleSaveQuote}
                    disabled={!quoteId}
                    aria-label="Salvar cotação"
                  >
                    Salvar cotação
                  </Button>
                </Flex>
              </Card>
            </Space>
          </Form>

          <Card
            title="Resultados da cotação"
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
            extra={
              <Select
                value={sortKey}
                onChange={(value: "price" | "eta" | "carrier") => {
                  setSortKey(value);
                  setSortLocked(true);
                }}
                options={[
                  { label: "Ordenar por preço", value: "price" },
                  { label: "Ordenar por prazo", value: "eta" },
                  { label: "Ordenar por transportadora", value: "carrier" },
                ]}
                style={{ width: 240 }}
              />
            }
          >
            {cotarMutation.isPending ? (
              <Typography.Text type="secondary">
                Calculando cotações...
              </Typography.Text>
            ) : sortedResults.length === 0 ? (
              <Typography.Text type="secondary">
                Realize uma cotação para visualizar as opções disponíveis.
              </Typography.Text>
            ) : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {sortedResults.map((result, index) => (
                  <QuoteResultCard
                    key={result.id}
                    result={result}
                    highlighted={index === 0}
                    onDetails={handleResultDetails}
                    onGenerate={handleGenerateLabel}
                    showInsuranceLabel={preferenciasValues.adicionais.seguro}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Space>

        <QuoteSummary
          origemDestino={origemDestinoValues}
          pacote={pacoteValues}
          origemInfo={origemInfo}
          destinoInfo={destinoInfo ?? undefined}
          onEdit={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => {
              const input = document.getElementById("cepDestinoInput");
              input?.focus();
            }, 300);
          }}
          cotacaoId={quoteId}
          onExportCsv={handleExportCsv}
          onSaveQuote={handleSaveQuote}
          results={results}
        />
      </Flex>
    </Space>
  );
}
