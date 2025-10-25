"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  Controller,
  FormProvider,
  SubmitHandler,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShallow } from "zustand/react/shallow";
import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import { maskCEP } from "@/lib/masks";
import { FlipCepsButtons } from "@/components/quote/FlipCepsButtons";
import {
  DEFAULT_CUBAGE_FACTOR,
  VolumesGrid,
} from "@/components/quote/VolumesGrid";
import { useQuoteStore } from "@/store/useQuoteStore";
import type {
  QuoteCalculateResponse,
  QuoteRequestPayload,
  QuoteSummary,
  QuoteVolume,
} from "@/types/quote";
import { useQuoteCalculate } from "@/hooks/useQuotes";
import { fetchCepV2, normalizeCep, formatCep } from "@/lib/services/brasilapi";
import { AddressSelect } from "@/components/addresses/AddressSelect";
import { AddressModal, type AddressFormValues } from "@/components/account/AddressModal";
import { useAddressStore } from "@/lib/state/addresses";
import { RecipientSelect } from "@/components/recipients/RecipientSelect";
import { RecipientModal, type RecipientFormValues } from "@/components/recipients/RecipientModal";
import { useRecipientsStore } from "@/lib/state/recipients";
import { useQuoteDraft } from "@/lib/state/quoteDraft";

const MAX_VOLUMES = 30;
const cepRegex = /^\d{5}-\d{3}$/;

const volumeSchema = z.object({
  id: z.string().min(1),
  comprimentoCm: z
    .number()
    .gt(0, "Comprimento deve ser maior que zero."),
  larguraCm: z
    .number()
    .gt(0, "Largura deve ser maior que zero."),
  alturaCm: z
    .number()
    .gt(0, "Altura deve ser maior que zero."),
  pesoKg: z
    .number()
    .gt(0, "Peso deve ser maior que zero."),
});

const quoteFormSchema = z.object({
  origemCep: z
    .string()
    .trim()
    .regex(cepRegex, "CEP inválido."),
  destinoCep: z
    .string()
    .trim()
    .regex(cepRegex, "CEP inválido."),
  coleta: z.boolean(),
  devolucao: z.boolean(),
  seguroValor: z
    .union([
      z
        .number()
        .min(0, "Valor do seguro deve ser maior ou igual a zero."),
      z.literal(null),
      z.undefined(),
    ])
    .optional(),
  lembrete: z
    .string()
    .trim()
    .max(40, "Lembrete deve ter no máximo 40 caracteres.")
    .optional(),
  volumes: z
    .array(volumeSchema)
    .min(1, "Adicione ao menos um volume.")
    .max(MAX_VOLUMES, `Limite máximo de ${MAX_VOLUMES} volumes.`),
});

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

const createEmptyVolume = (): QuoteFormValues["volumes"][number] => ({
  id: crypto.randomUUID(),
  comprimentoCm: 0,
  larguraCm: 0,
  alturaCm: 0,
  pesoKg: 0,
});

const computeTotals = (volumes: QuoteFormValues["volumes"] | undefined) => {
  if (!volumes?.length) {
    return { pesoRealKg: 0, pesoCubadoKg: 0 };
  }
  return volumes.reduce(
    (acc, volume) => {
      const comprimento = Number(volume.comprimentoCm) || 0;
      const largura = Number(volume.larguraCm) || 0;
      const altura = Number(volume.alturaCm) || 0;
      const peso = Number(volume.pesoKg) || 0;
      const cubado =
        comprimento && largura && altura
          ? (comprimento * largura * altura) / DEFAULT_CUBAGE_FACTOR
          : 0;
      return {
        pesoRealKg: acc.pesoRealKg + peso,
        pesoCubadoKg: acc.pesoCubadoKg + cubado,
      };
    },
    { pesoRealKg: 0, pesoCubadoKg: 0 },
  );
};

const formatKg = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

type QuoteFormProps = {
  defaultOrigin?: {
    cep: string;
    cidade?: string;
    uf?: string;
    label?: string;
    isDefault?: boolean;
  } | null;
};

export function QuoteForm({ defaultOrigin }: QuoteFormProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const calculateQuotes = useQuoteCalculate();

  const { form: storedForm, lastDestination, setResults } = useQuoteStore(
    useShallow((state) => ({
      form: state.form,
      lastDestination: state.lastDestination,
      setResults: state.setResults,
    })),
  );

  const defaultVolumes = storedForm?.volumes?.length
    ? storedForm.volumes.map((item) => ({ ...item }))
    : [createEmptyVolume()];

  const formMethods = useForm<QuoteFormValues>({
    resolver: zodResolver<QuoteFormValues, unknown, QuoteFormValues>(
      quoteFormSchema,
    ),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      origemCep: storedForm?.origemCep
        ? maskCEP(storedForm.origemCep)
        : defaultOrigin?.cep
        ? maskCEP(defaultOrigin.cep)
        : "",
      destinoCep: storedForm?.destinoCep
        ? maskCEP(storedForm.destinoCep)
        : "",
      coleta: storedForm?.coleta ?? false,
      devolucao: storedForm?.devolucao ?? false,
      seguroValor: storedForm?.seguroValor ?? undefined,
      lembrete: storedForm?.lembrete ?? undefined,
      volumes: defaultVolumes,
    },
  });

  const { control, handleSubmit, watch, setValue, getValues, trigger, formState } =
    formMethods;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "volumes",
  });

  // Estado e store de endereços - declarado antes dos useEffects que o usam
  const { selectedOriginId, selectOrigin, items: addresses, add: addAddress, getDefaultId } = useAddressStore();

  useEffect(() => {
    if (!fields.length) {
      replace([createEmptyVolume()]);
    }
  }, [fields.length, replace]);

  // Inicializa seleção de endereço com default (se houver)
  useEffect(() => {
    if (!selectedOriginId && addresses.length) {
      const id = getDefaultId();
      if (id) selectOrigin(id);
    }
  }, [addresses, selectedOriginId, selectOrigin, getDefaultId]);

  // Sincroniza endereço selecionado com form
  useEffect(() => {
    const addr = addresses.find((x) => x.id === selectedOriginId);
    if (!addr) return;

    setValue("origemCep", addr.cep, { shouldValidate: true, shouldDirty: true });
    setOrigemInfo({
      cidade: addr.cidade,
      uf: addr.uf,
      label: addr.apelido,
      isDefault: addr.isDefault,
    });
    setCepStatus((status) => ({ ...status, origem: true }));

    // Atualiza refs para evitar loops
    lastResolvedOrigin.current = normalizeCep(addr.cep);
    focusOriginResolved.current = true;
  }, [selectedOriginId, addresses, setValue]);

  // Carregar destino salvo ao montar
  useEffect(() => {
    if (!destination) return;

    // Restaurar modo
    setDestinationMode(destination.mode);

    // Restaurar CEP no form
    if (destination.cep) {
      setValue("destinoCep", destination.cep, { shouldValidate: true });
    }

    // Restaurar informações visuais
    if (destination.city && destination.state) {
      setDestinoInfo({
        cidade: destination.city,
        uf: destination.state,
      });
      setCepStatus((status) => ({ ...status, destino: true }));
    }

    // Se for modo recipient, restaurar seleção
    if (destination.mode === "recipient" && destination.recipientId) {
      setSelectedRecipientId(destination.recipientId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas na montagem

  const [origemInfo, setOrigemInfo] = useState<{
    cidade?: string;
    uf?: string;
    label?: string;
    isDefault?: boolean;
  } | null>(
    storedForm?.origemCidade || storedForm?.origemUf
      ? {
          cidade: storedForm.origemCidade,
          uf: storedForm.origemUf,
          label: storedForm.origemLabel,
          isDefault: storedForm.origemIsDefault,
        }
      : defaultOrigin
      ? {
          cidade: defaultOrigin.cidade,
          uf: defaultOrigin.uf,
          label: defaultOrigin.label,
          isDefault: defaultOrigin.isDefault,
        }
      : null,
  );

  const [destinoInfo, setDestinoInfo] = useState<{
    cidade?: string;
    uf?: string;
  } | null>(
    storedForm?.destinoCidade || storedForm?.destinoUf
      ? {
          cidade: storedForm.destinoCidade,
          uf: storedForm.destinoUf,
        }
      : null,
  );

  const [cepStatus, setCepStatus] = useState({
    origem: Boolean(storedForm?.origemCep),
    destino: Boolean(storedForm?.destinoCep),
  });

  // Refs para evitar loops de consulta CEP (apenas destino)
  const lastResolvedOrigin = useRef<string>("");
  const lastResolvedDest = useRef<string>("");
  const focusOriginResolved = useRef<boolean>(false);
  const focusDestResolved = useRef<boolean>(false);

  // Estados de loading e erro para CEP de destino
  const [destinoLoading, setDestinoLoading] = useState(false);
  const [destinoError, setDestinoError] = useState<string | null>(null);

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<string>(
    storedForm?.lembrete ?? "",
  );

  // Estado para modal de adicionar endereço
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  // Estados para destinatário
  const { destination, setDestination, setPickupAtOrigin } = useQuoteDraft();
  const [destinationMode, setDestinationMode] = useState<"manual" | "recipient">(
    destination?.mode ?? "manual"
  );
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    destination?.recipientId ?? null
  );
  const recipients = useRecipientsStore((s) => s.items);
  const addRecipient = useRecipientsStore((s) => s.add);

  // Estado para inversão visual dos labels (logística reversa)
  const [reverseLabels, setReverseLabels] = useState(false);

  const volumesValues = watch("volumes");
  const totals = useMemo(
    () => computeTotals(volumesValues),
    [volumesValues],
  );

  const lembreteValue = watch("lembrete");

  const canSubmit =
    formState.isValid &&
    cepStatus.origem &&
    cepStatus.destino &&
    !calculateQuotes.isPending;

  const handleAddVolume = useCallback(() => {
    if (fields.length >= MAX_VOLUMES) {
      message.info("Limite máximo de volumes atingido.");
      return;
    }
    append(createEmptyVolume());
    message.success("Volume adicionado.");
  }, [append, fields.length, message]);

  const handleRemoveVolume = useCallback(
    (index: number) => {
      if (fields.length <= 1) {
        message.warning("É necessário manter ao menos um volume.");
        return;
      }
      remove(index);
      message.success("Volume removido.");
    },
    [fields.length, message, remove],
  );

  const handleLogisticReverse = useCallback(() => {
    setReverseLabels((prev) => !prev);
  }, []);

  const handleAddressModalOpen = () => {
    setAddressModalOpen(true);
  };

  const handleAddressModalSubmit = (values: AddressFormValues) => {
    const newAddress = {
      id: crypto.randomUUID(),
      apelido: values.label,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
      isDefault: values.isDefault,
    };

    addAddress(newAddress, { select: true });
    setAddressModalOpen(false);
    message.success("Endereço adicionado com sucesso!");
  };

  const handleRecipientModalSubmit = (values: RecipientFormValues) => {
    const newRecipient = {
      id: crypto.randomUUID(),
      name: values.name,
      doc: values.doc,
      phone: values.phone,
      email: values.email,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
    };

    addRecipient(newRecipient);
    setSelectedRecipientId(newRecipient.id);

    // Salvar na store de draft
    setDestination({
      mode: "recipient",
      recipientId: newRecipient.id,
      recipientName: newRecipient.name,
      cep: newRecipient.cep,
      city: newRecipient.cidade,
      state: newRecipient.uf,
      street: newRecipient.logradouro ?? null,
      neighborhood: newRecipient.bairro ?? null,
    });

    // Preencher o CEP no formulário
    setValue("destinoCep", newRecipient.cep, { shouldValidate: true });
    setDestinoInfo({
      cidade: newRecipient.cidade,
      uf: newRecipient.uf,
    });
    setCepStatus((status) => ({ ...status, destino: true }));

    setRecipientModalOpen(false);
    message.success("Destinatário adicionado com sucesso!");
  };

  const handleRecipientSelect = (recipientId: string | null) => {
    setSelectedRecipientId(recipientId);

    if (!recipientId) {
      // Limpar destino
      setValue("destinoCep", "", { shouldValidate: false });
      setDestinoInfo(null);
      setCepStatus((status) => ({ ...status, destino: false }));
      return;
    }

    const recipient = recipients.find((r) => r.id === recipientId);
    if (!recipient) return;

    // Salvar na store de draft
    setDestination({
      mode: "recipient",
      recipientId: recipient.id,
      recipientName: recipient.name,
      cep: recipient.cep,
      city: recipient.cidade,
      state: recipient.uf,
      street: recipient.logradouro ?? null,
      neighborhood: recipient.bairro ?? null,
    });

    // Preencher o CEP no formulário
    setValue("destinoCep", recipient.cep, { shouldValidate: true });
    setDestinoInfo({
      cidade: recipient.cidade,
      uf: recipient.uf,
    });
    setCepStatus((status) => ({ ...status, destino: true }));
  };

  const handleReminderOpen = () => {
    setReminderDraft(lembreteValue ?? "");
    setReminderModalOpen(true);
  };

  const handleReminderSave = () => {
    const trimmed = reminderDraft.trim();
    if (trimmed.length > 40) {
      message.warning("Lembrete deve ter no máximo 40 caracteres.");
      return;
    }
    setValue("lembrete", trimmed || undefined, { shouldDirty: true });
    setReminderModalOpen(false);
  };

  const handleReminderRemove = () => {
    setValue("lembrete", undefined, { shouldDirty: true });
    setReminderDraft("");
  };

  const normalizeVolumes = (
    volumes: QuoteFormValues["volumes"],
  ): QuoteVolume[] =>
    volumes.map((volume) => ({
      id: volume.id,
      comprimentoCm: Number(volume.comprimentoCm),
      larguraCm: Number(volume.larguraCm),
      alturaCm: Number(volume.alturaCm),
      pesoKg: Number(volume.pesoKg),
    }));

  const buildSummary = (
    values: QuoteFormValues,
  ): QuoteSummary => ({
    origemCep: values.origemCep,
    origemCidade: origemInfo?.cidade,
    origemUf: origemInfo?.uf,
    origemLabel: origemInfo?.label,
    origemIsDefault: origemInfo?.isDefault,
    destinoCep: values.destinoCep,
    destinoCidade: destinoInfo?.cidade,
    destinoUf: destinoInfo?.uf,
    coleta: values.coleta,
    devolucao: values.devolucao,
    volumes: normalizeVolumes(values.volumes),
    seguroValor:
      values.seguroValor === undefined || values.seguroValor === null
        ? null
        : Number(values.seguroValor),
    lembrete: values.lembrete?.trim() || null,
  });

  // Handlers de CEP de destino (onFocus/onBlur)
  const handleDestFocus = () => {
    focusDestResolved.current = false;
  };

  const handleDestBlur = async () => {
    if (focusDestResolved.current) return;

    const rawCep = getValues("destinoCep");
    const normalized = normalizeCep(rawCep);

    if (normalized.length !== 8) {
      setDestinoInfo(null);
      setCepStatus((status) => ({ ...status, destino: false }));
      setDestinoError(null);
      return;
    }

    if (lastResolvedDest.current === normalized) {
      focusDestResolved.current = true;
      return;
    }

    setDestinoLoading(true);
    setDestinoError(null);

    try {
      const data = await fetchCepV2(normalized);
      setDestinoInfo({
        cidade: data.city,
        uf: data.state,
      });
      setCepStatus((status) => ({ ...status, destino: true }));
      lastResolvedDest.current = normalized;
      focusDestResolved.current = true;

      // Salvar na store de draft quando modo manual
      if (destinationMode === "manual") {
        setDestination({
          mode: "manual",
          cep: formatCep(normalized),
          city: data.city,
          state: data.state,
          street: data.street ?? null,
          neighborhood: data.neighborhood ?? null,
        });
      }
    } catch (error) {
      const err = error as { message?: string };
      setDestinoError(err?.message || "Erro ao consultar CEP");
      setDestinoInfo(null);
      setCepStatus((status) => ({ ...status, destino: false }));
    } finally {
      setDestinoLoading(false);
    }
  };

  const onSubmit: SubmitHandler<QuoteFormValues> = async (values) => {
    const payload: QuoteRequestPayload = {
      origem: { cep: values.origemCep },
      destino: { cep: values.destinoCep },
      coleta: values.coleta,
      devolucao: values.devolucao,
      seguro:
        values.seguroValor === undefined || values.seguroValor === null
          ? null
          : Number(values.seguroValor),
      lembrete: values.lembrete?.trim() || null,
      volumes: values.volumes.map((item) => ({
        comprimentoCm: Number(item.comprimentoCm),
        larguraCm: Number(item.larguraCm),
        alturaCm: Number(item.alturaCm),
        pesoKg: Number(item.pesoKg),
      })),
    };

    try {
      const response = await calculateQuotes.mutateAsync(payload);
      const normalized: QuoteCalculateResponse = Array.isArray(response)
        ? { results: response }
        : response;

      if (!normalized.results.length) {
        message.warning(
          "Nenhum serviço disponível para os parâmetros informados.",
        );
        return;
      }

      const quoteId = crypto.randomUUID();
      const resumo = buildSummary(values);

      setResults({
        quoteId,
        createdAt: new Date().toISOString(),
        resumo,
        results: normalized.results,
        pontosParceiros: normalized.pontosParceiros,
      });

      dispatchTelemetry("quote_form_submit", {
        quoteId,
        volumesCount: values.volumes.length,
        pesoTotalKg: totals.pesoRealKg,
        pesoCubadoTotalKg: totals.pesoCubadoKg,
        coleta: values.coleta,
        devolucao: values.devolucao,
        hasInsuranceValue: Boolean(payload.seguro),
      });

      router.push(`/cotacoes/resultados?quoteId=${quoteId}`);
    } catch (error) {
      console.error("Erro ao calcular cotações", error);
      message.error("Não foi possível calcular as cotações. Tente novamente.");
    }
  };

  // Labels dinâmicos para inversão visual (logística reversa)
  const origemLabel = reverseLabels ? "Destinatário" : "Endereço de origem";
  const destinoLabel = reverseLabels ? "Endereço de origem" : "Destinatário";

  return (
    <FormProvider {...formMethods}>
      <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
        <Card>
          <Row gutter={[32, 24]}>
            <Col xs={24} lg={10}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      Dados de origem e destino
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      Informe os CEPs para validar a rota
                    </Typography.Text>
                  </div>
                  <FlipCepsButtons
                    onLogisticReverse={handleLogisticReverse}
                    reverseActive={reverseLabels}
                    disabled={calculateQuotes.isPending}
                  />
                </div>

                <Form.Item
                  label={origemLabel}
                  extra={
                    origemInfo?.cidade && origemInfo?.uf ? (
                      <Typography.Text type="secondary">
                        {origemInfo.cidade} / {origemInfo.uf}
                        {origemInfo.label && ` · ${origemInfo.label}`}
                      </Typography.Text>
                    ) : null
                  }
                >
                  <AddressSelect
                    value={selectedOriginId}
                    onChange={(id) => selectOrigin(id)}
                    onAddAddress={handleAddressModalOpen}
                    placeholder={`Selecione ${reverseLabels ? "um destinatário" : "um endereço de origem"}`}
                  />
                </Form.Item>

                <Form.Item label={`Como deseja informar ${reverseLabels ? "a origem" : "o destino"}?`}>
                  <Radio.Group
                    value={destinationMode}
                    onChange={(e) => {
                      const newMode = e.target.value as "manual" | "recipient";
                      setDestinationMode(newMode);

                      // Limpar destino ao trocar de modo
                      if (newMode === "manual") {
                        setSelectedRecipientId(null);
                      } else {
                        setValue("destinoCep", "", { shouldValidate: false });
                        setDestinoInfo(null);
                        setCepStatus((status) => ({ ...status, destino: false }));
                      }
                    }}
                  >
                    <Radio value="manual">Informar manualmente o CEP</Radio>
                    <Radio value="recipient">Selecionar destinatário recorrente</Radio>
                  </Radio.Group>
                </Form.Item>

                {destinationMode === "manual" ? (
                  <Controller
                    name="destinoCep"
                    control={control}
                    render={({ field, fieldState }) => {
                      const suffix = destinoLoading ? (
                        <Spin size="small" />
                      ) : cepStatus.destino ? (
                        <CheckCircleTwoTone twoToneColor="#389e0d" />
                      ) : destinoError ? (
                        <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                      ) : null;

                      return (
                        <Form.Item
                          label={reverseLabels ? "CEP de origem" : "CEP de destino"}
                          validateStatus={
                            fieldState.error || destinoError ? "error" : undefined
                          }
                          help={fieldState.error?.message || destinoError || undefined}
                          extra={
                            destinoInfo?.cidade && destinoInfo?.uf ? (
                              <Typography.Text type="secondary">
                                {destinoInfo.cidade} / {destinoInfo.uf}
                              </Typography.Text>
                            ) : null
                          }
                        >
                          <Input
                            {...field}
                            value={formatCep(field.value ?? "")}
                            onChange={(e) => {
                              const normalized = normalizeCep(e.target.value);
                              field.onChange(formatCep(normalized));
                            }}
                            onFocus={handleDestFocus}
                            onBlur={() => {
                              field.onBlur();
                              void handleDestBlur();
                            }}
                            maxLength={9}
                            placeholder="00000-000"
                            suffix={suffix}
                            autoComplete="postal-code"
                            inputMode="numeric"
                          />
                        </Form.Item>
                      );
                    }}
                  />
                ) : (
                  <Form.Item
                    label={reverseLabels ? "Endereço de origem recorrente" : "Destinatário recorrente"}
                    extra={
                      destinoInfo?.cidade && destinoInfo?.uf ? (
                        <Typography.Text type="secondary">
                          {destinoInfo.cidade} / {destinoInfo.uf}
                        </Typography.Text>
                      ) : null
                    }
                  >
                    <RecipientSelect
                      value={selectedRecipientId}
                      onChange={handleRecipientSelect}
                      onAddRecipient={() => setRecipientModalOpen(true)}
                      placeholder={`Selecione ${reverseLabels ? "um endereço de origem" : "um destinatário"}`}
                    />
                  </Form.Item>
                )}

                <Controller
                  control={control}
                  name="seguroValor"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Valor do seguro (R$)"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <InputNumber
                        {...field}
                        value={field.value ?? undefined}
                        placeholder="Opcional"
                        min={0}
                        step={100}
                        style={{ width: "100%" }}
                        onChange={(val) => field.onChange(val ?? undefined)}
                      />
                    </Form.Item>
                  )}
                />

                <div>
                  <Typography.Title level={5}>Preferências</Typography.Title>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Controller
                      control={control}
                      name="coleta"
                      render={({ field }) => (
                        <Flex align="center" gap={12}>
                          <Switch
                            checked={field.value}
                            onChange={(checked) => {
                              field.onChange(checked);
                              setPickupAtOrigin(checked);
                            }}
                            disabled={calculateQuotes.isPending}
                          />
                          <div>
                            <Typography.Text>
                              Solicitar coleta na origem
                            </Typography.Text>
                            <br />
                            <Typography.Text type="secondary">
                              Disponível para CEPs com cobertura de coleta
                            </Typography.Text>
                          </div>
                        </Flex>
                      )}
                    />
                  </Space>
                </div>

                <div>
                  <Typography.Title level={5} style={{ marginBottom: 8 }}>
                    Lembrete
                  </Typography.Title>
                  {lembreteValue ? (
                    <Space size={8}>
                      <Tag>{lembreteValue}</Tag>
                      <Button type="text" onClick={handleReminderOpen}>
                        Editar
                      </Button>
                      <Button type="text" danger onClick={handleReminderRemove}>
                        Remover
                      </Button>
                    </Space>
                  ) : (
                    <Button type="link" onClick={handleReminderOpen}>
                      Adicionar lembrete
                    </Button>
                  )}
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 0 }}
                  >
                    O lembrete aparece no banner de resultados e na finalização.
                  </Typography.Paragraph>
                </div>
              </Space>
            </Col>

            <Col xs={24} lg={14}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <div>
                  <Typography.Title level={4} style={{ marginBottom: 4 }}>
                    Volumes do envio
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Informe medidas internas e peso de cada volume
                  </Typography.Text>
                </div>

                <VolumesGrid
                  control={control}
                  fields={fields}
                  values={volumesValues}
                  onAdd={handleAddVolume}
                  onRemove={handleRemoveVolume}
                  maxCount={MAX_VOLUMES}
                  totals={totals}
                  disableRemove={calculateQuotes.isPending}
                />
              </Space>
            </Col>
          </Row>

          <Divider />

          <Flex align="center" justify="space-between" wrap gap={16}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <div>
                Volumes: <strong>{fields.length}</strong>
              </div>
              <div>
                Peso total: <strong>{formatKg(totals.pesoRealKg)} kg</strong>
              </div>
              <div>
                Cubado: <strong>{formatKg(totals.pesoCubadoKg)} kg</strong>
              </div>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={calculateQuotes.isPending}
              disabled={!canSubmit}
            >
              {calculateQuotes.isPending ? "Calculando cotações..." : "Calcular"}
            </Button>
          </Flex>
        </Card>
      </Form>

      <Modal
        title="Adicionar lembrete"
        open={reminderModalOpen}
        onCancel={() => setReminderModalOpen(false)}
        onOk={handleReminderSave}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Input
          value={reminderDraft}
          onChange={(event) => setReminderDraft(event.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="Até 40 caracteres"
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Exibido no banner de resultados e na finalização da cotação.
        </Typography.Paragraph>
      </Modal>

      <AddressModal
        open={addressModalOpen}
        onCancel={() => setAddressModalOpen(false)}
        onSubmit={handleAddressModalSubmit}
      />

      <RecipientModal
        open={recipientModalOpen}
        onCancel={() => setRecipientModalOpen(false)}
        onSubmit={handleRecipientModalSubmit}
      />
    </FormProvider>
  );
}
