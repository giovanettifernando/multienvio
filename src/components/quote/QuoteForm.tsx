"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Row,
  Space,
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
import { maskCEP } from "@/lib/masks";
import { FlipCepsButtons } from "@/components/quote/FlipCepsButtons";
import { CepField } from "@/components/quote/CepField";
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

  useEffect(() => {
    if (!fields.length) {
      replace([createEmptyVolume()]);
    }
  }, [fields.length, replace]);

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

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<string>(
    storedForm?.lembrete ?? "",
  );

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
  const origemLabel = reverseLabels ? "CEP de destino" : "CEP de origem";
  const destinoLabel = reverseLabels ? "CEP de origem" : "CEP de destino";

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

                <CepField
                  name="origemCep"
                  label={origemLabel}
                  placeholder="00000-000"
                  initialResolved={{
                    cidade: origemInfo?.cidade,
                    uf: origemInfo?.uf,
                  }}
                  onResolvedChange={(resolved) => {
                    setCepStatus((status) => ({
                      ...status,
                      origem: Boolean(resolved),
                    }));
                    if (resolved) {
                      setOrigemInfo((current) => ({
                        cidade: resolved.cidade,
                        uf: resolved.uf,
                        label: current?.label,
                        isDefault: current?.isDefault,
                      }));
                    }
                  }}
                />

                <CepField
                  name="destinoCep"
                  label={destinoLabel}
                  placeholder="00000-000"
                  initialResolved={{
                    cidade: destinoInfo?.cidade,
                    uf: destinoInfo?.uf,
                  }}
                  onResolvedChange={(resolved) => {
                    setCepStatus((status) => ({
                      ...status,
                      destino: Boolean(resolved),
                    }));
                    if (resolved) {
                      setDestinoInfo({
                        cidade: resolved.cidade,
                        uf: resolved.uf,
                      });
                    }
                  }}
                />

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
                            onChange={(checked) => field.onChange(checked)}
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
    </FormProvider>
  );
}
