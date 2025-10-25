"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Skeleton,
  Space,
  Typography,
  message,
} from "antd";
import type { CompanyWizardData } from "@/lib/validation/company";
import { getCompanyDisplayName } from "@/lib/validation/company";
import {
  shipmentSchema,
  type ServicoData,
} from "@/lib/validation/shipment";
type ShipmentValues = z.infer<typeof shipmentSchema>;
import { normalizeCEPInput, normalizePhoneInput } from "@/lib/masks";
import { LabelPreview } from "@/components/ui/LabelPreview";

const CEP_REGEX = /^[0-9]{5}-?[0-9]{3}$/u;

type ServiceOption = {
  code: string;
  name: string;
  carrier: string;
  etaDays: number;
  price: number;
  maxWeightKg: number;
};

type ServicesResponse = {
  services: ServiceOption[];
};

type LabelResponse = {
  id: string;
  pdfUrl: string;
  generatedAt: string;
};

type CEPLookupResponse =
  | {
      found: true;
      cep: string;
      logradouro: string;
      bairro: string;
      cidade: string;
      uf: string;
    }
  | {
      found: false;
      mensagem?: string;
    };

export type QuotePreset = {
  id: string;
  pacote: {
    pesoKg: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    valorDeclarado: number;
  };
  serviceCode: string;
  valorFrete: number;
};

type LabelShipmentFormProps = {
  company: CompanyWizardData;
  presetFromQuote?: QuotePreset | null;
  onCancel?: () => void;
  initialServiceCode?: string | null;
};

async function fetchServices(): Promise<ServicesResponse> {
  const response = await fetch("/api/services");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os serviços");
  }
  return response.json();
}

async function lookupCep(value: string): Promise<CEPLookupResponse> {
  const response = await fetch(`/api/cep?cep=${value}`);
  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP");
  }
  return response.json();
}

export function LabelShipmentForm({
  company,
  presetFromQuote,
  onCancel,
  initialServiceCode,
}: LabelShipmentFormProps) {
  const router = useRouter();
  const [messageApi, messageContext] = message.useMessage();
  const [cepLoading, setCepLoading] = useState(false);
  const [lastCep, setLastCep] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultValues = useMemo<ShipmentValues>(() => {
    const preset = presetFromQuote;
    return {
      cotacaoId: preset?.id,
      destinatario: {
        nome: "",
        email: undefined,
        telefone: undefined,
        cep: "",
        logradouro: "",
        numero: "",
        complemento: undefined,
        bairro: "",
        cidade: "",
        uf: "",
      },
      pacote: {
        pesoKg: preset?.pacote.pesoKg ?? 1,
        comprimentoCm: preset?.pacote.comprimentoCm ?? 20,
        larguraCm: preset?.pacote.larguraCm ?? 15,
        alturaCm: preset?.pacote.alturaCm ?? 10,
      },
      servico: {
        serviceCode: preset?.serviceCode ?? initialServiceCode ?? "",
        declaredValue: preset?.pacote.valorDeclarado,
        avisoRecebimento: false,
        maoPropria: false,
      },
    };
  }, [presetFromQuote, initialServiceCode]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShipmentValues>({
    resolver: zodResolver(shipmentSchema) as Resolver<ShipmentValues>,
    defaultValues,
  });

  const destinatarioCep = watch("destinatario.cep");
  const selectedServiceCode = watch("servico.serviceCode");

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const services = useMemo<ServiceOption[]>(
    () => servicesQuery.data?.services ?? [],
    [servicesQuery.data],
  );
  const selectedService = services.find(
    (service) => service.code === selectedServiceCode,
  );

  useEffect(() => {
    if (!services.length) return;
    const fallback = services[0]?.code;
    const preferred = initialServiceCode && services.some((s) => s.code === initialServiceCode)
      ? initialServiceCode
      : undefined;

    const targetCode = selectedServiceCode || preferred || fallback;
    if (targetCode && targetCode !== selectedServiceCode) {
      setValue("servico.serviceCode", targetCode, {
        shouldDirty: false,
      });
    }
  }, [services, selectedServiceCode, setValue, initialServiceCode]);

  useEffect(() => {
    if (!destinatarioCep) return;
    if (!CEP_REGEX.test(destinatarioCep)) return;
    if (destinatarioCep === lastCep) return;

    setCepLoading(true);
    lookupCep(destinatarioCep)
      .then((response) => {
        if (!response.found) {
          messageApi.warning(response.mensagem ?? "CEP não encontrado");
          setLastCep(destinatarioCep);
          return;
        }
        setValue("destinatario.logradouro", response.logradouro, {
          shouldDirty: true,
        });
        setValue("destinatario.bairro", response.bairro, {
          shouldDirty: true,
        });
        setValue("destinatario.cidade", response.cidade, {
          shouldDirty: true,
        });
        setValue("destinatario.uf", response.uf, {
          shouldDirty: true,
        });
        setLastCep(destinatarioCep);
      })
      .catch(() => {
        messageApi.error("Não foi possível consultar o CEP");
      })
      .finally(() => setCepLoading(false));
  }, [destinatarioCep, lastCep, messageApi, setValue]);

const emitMutation = useMutation<{ shipment: { id: string }; label: LabelResponse }, Response, ShipmentValues>({
  mutationFn: async (values) => {
    // 1) valida o serviço selecionado
    const serviceDetails = services.find(
      (item) => item.code === values.servico.serviceCode,
    );
    if (!serviceDetails) {
      throw new Response(null, {
        status: 400,
        statusText: "Serviço inválido",
      });
    }

    // 2) cria o shipment
    const resShipment = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        servico: {
          ...values.servico,
          carrier: serviceDetails.carrier,
        },
      }),
    });
    if (!resShipment.ok) throw resShipment;
    const shipment = await resShipment.json();

    // 3) gera a etiqueta
    const resLabel = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId: shipment.id }),
    });
    if (!resLabel.ok) throw resLabel;
    const label = await resLabel.json();

    return { shipment, label };
  },

  onSuccess: ({ shipment }) => {
    messageApi.success("Etiqueta emitida com sucesso!");
    if (shipment?.id) {
      router.replace(`/shipments/${shipment.id}`);
    }
  },

  onError: async (error) => {
    let text = "Não foi possível emitir a etiqueta";
    try {
      const body = await error.json();
      if (body?.mensagem) text = body.mensagem;
    } catch {
      // mantém texto genérico
    }
    messageApi.error(text);
  },
});


  const onSubmit = async (values: ShipmentValues) => {
    setFormError(null);
    emitMutation.mutate(values);
  };

  const remetente = company;

  return (
    <Flex gap={24} align="start" wrap>
      {messageContext}
      <Space direction="vertical" size={24} style={{ flex: 1, minWidth: 0 }}>
        {formError ? (
          <Alert type="error" message={formError} showIcon closable />
        ) : null}

        <Card title="Remetente" variant="borderless">
          <Typography.Text strong>
            {getCompanyDisplayName(remetente)}
          </Typography.Text>
          <Typography.Paragraph style={{ margin: 0 }}>
            {`${remetente.endereco.logradouro}, ${remetente.endereco.numero}`}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            {`${remetente.endereco.bairro} · ${remetente.endereco.cidade}/${remetente.endereco.uf}`}
          </Typography.Paragraph>
        </Card>

        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit(onSubmit)}
        >
          <Card title="Destinatário" variant="borderless" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Controller
                  name="destinatario.nome"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Nome completo"
                      required
                      validateStatus={errors.destinatario?.nome ? "error" : ""}
                      help={errors.destinatario?.nome?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Nome do destinatário"
                        aria-invalid={Boolean(errors.destinatario?.nome)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12}>
              <Controller
                name="destinatario.email"
                control={control}
                render={({ field }) => (
                  <Form.Item
                    label="E-mail"
                    validateStatus={errors.destinatario?.email ? "error" : ""}
                    help={errors.destinatario?.email?.message}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value.trim() === ""
                            ? undefined
                            : event.target.value,
                        )
                      }
                      placeholder="destinatario@email.com"
                      aria-invalid={Boolean(errors.destinatario?.email)}
                    />
                  </Form.Item>
                )}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Controller
                  name="destinatario.telefone"
                  control={control}
                render={({ field }) => (
                  <Form.Item
                    label="Telefone"
                    validateStatus={errors.destinatario?.telefone ? "error" : ""}
                    help={errors.destinatario?.telefone?.message}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const normalized = normalizePhoneInput(
                          event.target.value,
                        );
                        field.onChange(
                          normalized.trim() === "" ? undefined : normalized,
                        );
                      }}
                      placeholder="(11) 98765-4321"
                      aria-invalid={Boolean(errors.destinatario?.telefone)}
                    />
                  </Form.Item>
                )}
                />
              </Col>
              <Col xs={24} md={8}>
                <Controller
                  name="destinatario.cep"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="CEP"
                      required
                      validateStatus={
                        errors.destinatario?.cep
                          ? "error"
                          : cepLoading
                          ? "validating"
                          : ""
                      }
                      help={
                        errors.destinatario?.cep?.message ??
                        (cepLoading ? "Consultando CEP..." : undefined)
                      }
                    >
                      <Input
                        {...field}
                        value={normalizeCEPInput(field.value ?? "")}
                        onChange={(event) =>
                          field.onChange(normalizeCEPInput(event.target.value))
                        }
                        placeholder="00000-000"
                        maxLength={9}
                        aria-invalid={Boolean(errors.destinatario?.cep)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Controller
                  name="destinatario.logradouro"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Logradouro"
                      required
                      validateStatus={
                        errors.destinatario?.logradouro ? "error" : ""
                      }
                      help={errors.destinatario?.logradouro?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Rua/avenida"
                        aria-invalid={Boolean(errors.destinatario?.logradouro)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={4}>
                <Controller
                  name="destinatario.numero"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Número"
                      required
                      validateStatus={errors.destinatario?.numero ? "error" : ""}
                      help={errors.destinatario?.numero?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Nº"
                        aria-invalid={Boolean(errors.destinatario?.numero)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={6}>
                <Controller
                  name="destinatario.complemento"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="Complemento">
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Apto, sala, etc"
                      />
                    </Form.Item>
                  )}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Controller
                  name="destinatario.bairro"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Bairro"
                      required
                      validateStatus={errors.destinatario?.bairro ? "error" : ""}
                      help={errors.destinatario?.bairro?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Bairro"
                        aria-invalid={Boolean(errors.destinatario?.bairro)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={8}>
                <Controller
                  name="destinatario.cidade"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Cidade"
                      required
                      validateStatus={errors.destinatario?.cidade ? "error" : ""}
                      help={errors.destinatario?.cidade?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Cidade"
                        aria-invalid={Boolean(errors.destinatario?.cidade)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={4}>
                <Controller
                  name="destinatario.uf"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="UF"
                      required
                      validateStatus={errors.destinatario?.uf ? "error" : ""}
                      help={errors.destinatario?.uf?.message}
                    >
                      <Input
                        {...field}
                        value={field.value?.toUpperCase() ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                        placeholder="UF"
                        maxLength={2}
                        aria-invalid={Boolean(errors.destinatario?.uf)}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>

          <Card title="Pacote" variant="borderless" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Controller
                  name="pacote.pesoKg"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Peso (kg)"
                      required
                      validateStatus={errors.pacote?.pesoKg ? "error" : ""}
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
              </Col>
              <Col xs={24} md={6}>
                <Controller
                  name="pacote.comprimentoCm"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Comprimento (cm)"
                      required
                      validateStatus={
                        errors.pacote?.comprimentoCm ? "error" : ""
                      }
                      help={errors.pacote?.comprimentoCm?.message}
                    >
                      <InputNumber
                        {...field}
                        style={{ width: "100%" }}
                        min={16}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={6}>
                <Controller
                  name="pacote.larguraCm"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Largura (cm)"
                      required
                      validateStatus={errors.pacote?.larguraCm ? "error" : ""}
                      help={errors.pacote?.larguraCm?.message}
                    >
                      <InputNumber
                        {...field}
                        style={{ width: "100%" }}
                        min={11}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={6}>
                <Controller
                  name="pacote.alturaCm"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Altura (cm)"
                      required
                      validateStatus={errors.pacote?.alturaCm ? "error" : ""}
                      help={errors.pacote?.alturaCm?.message}
                    >
                      <InputNumber
                        {...field}
                        style={{ width: "100%" }}
                        min={2}
                      />
                    </Form.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>

          <Card title="Serviço" variant="borderless" style={{ marginBottom: 24 }}>
            {servicesQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : services.length === 0 ? (
              <Alert
                type="warning"
                message="Nenhum serviço disponível"
                description="Verifique os dados do pacote ou tente novamente mais tarde."
              />
            ) : (
              <Radio.Group
                onChange={(event) =>
                  setValue("servico.serviceCode", event.target.value, {
                    shouldDirty: true,
                  })
                }
                value={selectedServiceCode}
                style={{ width: "100%" }}
              >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {services.map((service) => (
                    <Card
                      key={service.code}
                      type={
                        service.code === selectedServiceCode ? "inner" : undefined
                      }
                      style={{ borderColor: service.code === selectedServiceCode ? "var(--color-primary)" : undefined }}
                      onClick={() =>
                        setValue("servico.serviceCode", service.code, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <Radio value={service.code} style={{ width: "100%" }}>
                        <Flex
                          justify="space-between"
                          align="center"
                          wrap
                          gap={12}
                        >
                          <Space direction="vertical" size={0}>
                            <Typography.Text strong>{service.name}</Typography.Text>
                            <Typography.Text type="secondary">
                              {service.carrier} · até {service.etaDays} dias úteis
                            </Typography.Text>
                          </Space>
                          <Typography.Text strong>
                            {service.price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </Typography.Text>
                        </Flex>
                      </Radio>
                    </Card>
                  ))}
                </Space>
              </Radio.Group>
            )}
          </Card>

          <Card title="Revisão" variant="borderless" style={{ marginBottom: 24 }}>
            <Typography.Paragraph style={{ marginBottom: 12 }}>
              Revise os dados antes de emitir a etiqueta.
            </Typography.Paragraph>
            <Divider style={{ margin: "12px 0" }} />
            <Space>
              <Button onClick={onCancel}>Cancelar</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={emitMutation.isPending}
              >
                Emitir etiqueta
              </Button>
            </Space>
          </Card>
        </Form>
      </Space>

      <LabelPreview
        sender={company}
        recipient={watch("destinatario")}
        packageData={watch("pacote")}
        service={{
          ...watch("servico"),
          name: selectedService?.name,
          carrier: selectedService?.carrier,
        } as ServicoData & { name?: string; carrier?: string }}
        pdfUrl={emitMutation.data?.label?.pdfUrl}
      />
    </Flex>
  );
}
