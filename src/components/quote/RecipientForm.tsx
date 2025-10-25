"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContactsOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Card,
  Empty,
  Form,
  Input,
  Radio,
  Space,
  Tabs,
  Typography,
  Checkbox,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  Controller,
  useFormContext,
} from "react-hook-form";
import { maskCEP, maskCPF, maskCNPJ, maskPhone } from "@/lib/masks";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useRecipients } from "@/hooks/useQuotes";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import type { Recipient } from "@/types/quote";

const cepRegex = /^\d{5}-\d{3}$/;

type ValidationStatus = "idle" | "validating" | "valid" | "error";

const fetchCep = async (cep: string) => {
  const response = await fetch(`/api/cep/${cep}`);
  if (!response.ok) throw new Error("Erro ao consultar CEP");
  return response.json() as Promise<{
    valido: boolean;
    cidade?: string;
    uf?: string;
    mensagemErro?: string;
  }>;
};

export function RecipientForm() {
  const results = useQuoteStore((state) => state.results);
  const destinoCep = results?.resumo.destinoCep ?? "";

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FinalizeFormValues>();

  const mode = watch("recipient.mode") ?? "manual";
  const savedId = watch("recipient.savedId");
  const manual = watch("recipient.manual");

  const recipientsQuery = useRecipients(destinoCep);
  const recipients = useMemo(
    () => recipientsQuery.data ?? [],
    [recipientsQuery.data],
  );

  const [cepStatus, setCepStatus] = useState<ValidationStatus>("idle");
  const [cepError, setCepError] = useState<string | null>(null);

  const cepValue = manual?.cep ?? "";

  const cepQuery = useQuery({
    queryKey: ["recipient-cep", cepValue],
    queryFn: () => fetchCep(cepValue),
    enabled: cepRegex.test(cepValue),
  });

  useEffect(() => {
    if (!cepValue || !cepRegex.test(cepValue)) {
      setCepStatus("idle");
      setCepError(null);
      return;
    }
    if (cepQuery.isFetching) {
      setCepStatus("validating");
      return;
    }
    if (cepQuery.isError) {
      setCepStatus("error");
      setCepError("Não foi possível validar o CEP.");
      return;
    }
    const data = cepQuery.data;
    if (!data) return;
    if (data.valido) {
      setCepStatus("valid");
      setCepError(null);
      if (data.cidade) {
        setValue("recipient.manual.cidade", data.cidade, { shouldDirty: true });
      }
      if (data.uf) {
        setValue("recipient.manual.uf", data.uf, { shouldDirty: true });
      }
    } else {
      setCepStatus("error");
      setCepError(data.mensagemErro ?? "CEP inválido.");
    }
  }, [cepQuery.data, cepQuery.isError, cepQuery.isFetching, cepValue, setValue]);

  const handleModeChange = (key: string) => {
    setValue("recipient.mode", key as "manual" | "saved", { shouldDirty: true });
  };

  const handleSelectRecipient = useCallback((recipient: Recipient) => {
    setValue("recipient.savedId", recipient.id, { shouldDirty: true });
    setValue("recipient.manual", {
      nome: recipient.nome,
      telefone: recipient.telefone,
      email: recipient.email ?? "",
      documento: recipient.documento,
      cep: recipient.cep,
      logradouro: recipient.logradouro,
      numero: recipient.numero,
      complemento: recipient.complemento ?? "",
      bairro: recipient.bairro,
      cidade: recipient.cidade,
      uf: recipient.uf,
      observacoes: recipient.observacoes ?? "",
      salvarRecorrente: false,
    });
  }, [setValue]);

  const manualErrors = errors.recipient?.manual ?? {};

  const savedContent = useMemo(() => {
    if (recipientsQuery.isLoading) {
      return <Typography.Paragraph>Carregando destinatários...</Typography.Paragraph>;
    }
    if (!recipients.length) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Não encontramos destinatários salvos para este CEP."
        />
      );
    }
    return (
      <Radio.Group
        style={{ width: "100%" }}
        value={savedId}
        onChange={(event) => {
          const recipient = recipients.find((r) => r.id === event.target.value);
          if (recipient) {
            handleSelectRecipient(recipient);
          }
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
        {recipients.map((recipient) => (
          <Card
            key={recipient.id}
            hoverable
            onClick={() => handleSelectRecipient(recipient)}
            styles={{ body: { padding: 16 } }}
          >
            <Space align="start">
              <Radio value={recipient.id} />
              <div>
                  <Typography.Text strong>{recipient.nome}</Typography.Text>
                  <div>
                    <Typography.Text type="secondary">
                      {recipient.logradouro}, {recipient.numero}
                      {recipient.complemento ? ` - ${recipient.complemento}` : ""} •{" "}
                      {recipient.bairro}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary">
                      {recipient.cidade}/{recipient.uf} • CEP {recipient.cep}
                    </Typography.Text>
                  </div>
                </div>
              </Space>
            </Card>
          ))}
        </Space>
      </Radio.Group>
    );
  }, [handleSelectRecipient, recipients, recipientsQuery.isLoading, savedId]);

  return (
    <Card title="Destinatário">
      <Tabs
        activeKey={mode}
        onChange={handleModeChange}
        items={[
          {
            key: "manual",
            label: "Preencher manualmente",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Controller
                  control={control}
                  name="recipient.manual.nome"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Nome completo"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Nome do destinatário" prefix={<UserOutlined />} />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.telefone"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Telefone"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input
                        {...field}
                        placeholder="(00) 00000-0000"
                        prefix={<PhoneOutlined />}
                        onChange={(event) =>
                          field.onChange(maskPhone(event.target.value))
                        }
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.email"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="E-mail"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="email@exemplo.com" prefix={<MailOutlined />} />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.documento"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="CPF/CNPJ"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input
                        {...field}
                        placeholder="Digite o CPF ou CNPJ"
                        prefix={<ContactsOutlined />}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "");
                          const formatted =
                            digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits);
                          field.onChange(formatted);
                        }}
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.cep"
                  render={({ field }) => (
                    <Form.Item
                      label="CEP"
                      validateStatus={
                        cepError || manualErrors?.cep ? "error" : cepStatus === "valid" ? "success" : undefined
                      }
                      help={cepError ?? (manualErrors?.cep as { message?: string })?.message}
                    >
                      <Input
                        {...field}
                        placeholder="00000-000"
                        onChange={(event) => {
                          const value = maskCEP(event.target.value);
                          field.onChange(value);
                        }}
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.logradouro"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Logradouro"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Rua, avenida, etc." />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.numero"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Número"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Número" />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.complemento"
                  render={({ field }) => (
                    <Form.Item label="Complemento">
                      <Input {...field} placeholder="Apartamento, bloco, etc." />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.bairro"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Bairro"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Bairro" />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.cidade"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Cidade"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Cidade" />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.uf"
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="UF"
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="UF" maxLength={2} />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.observacoes"
                  render={({ field }) => (
                    <Form.Item label="Observações">
                      <Input.TextArea
                        {...field}
                        placeholder="Referências de entrega, horários, etc."
                        rows={3}
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="recipient.manual.salvarRecorrente"
                  render={({ field }) => (
                    <Form.Item>
                      <Checkbox
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      >
                        Salvar destinatário recorrente
                      </Checkbox>
                    </Form.Item>
                  )}
                />
              </Space>
            ),
          },
          {
            key: "saved",
            label: "Selecionar destinatário",
            children: savedContent,
          },
        ]}
      />
    </Card>
  );
}
