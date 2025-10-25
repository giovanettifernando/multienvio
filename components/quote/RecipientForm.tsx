"use client";

import { useEffect } from "react";
import {
  ContactsOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Form,
  Input,
  Space,
  Typography,
  Checkbox,
  Button,
} from "antd";
import {
  Controller,
  useFormContext,
} from "react-hook-form";
import { maskCPF, maskCNPJ, maskPhone } from "@/lib/masks";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import type { FinalizeFormValues } from "@/types/quoteFinalize";

export function RecipientForm() {
  const router = useRouter();
  const { destination, hydrated } = useQuoteDraft(
    useShallow((s) => ({ destination: s.destination, hydrated: s._hasHydrated }))
  );

  const {
    control,
    setValue,
  } = useFormContext<FinalizeFormValues>();

  // Preencher campos bloqueados ao montar (apenas se modo manual)
  useEffect(() => {
    if (!destination || destination.mode !== "manual") return;

    setValue("recipient.manual.cep", destination.cep ?? "", { shouldDirty: false });
    setValue("recipient.manual.logradouro", destination.street ?? "", { shouldDirty: false });
    setValue("recipient.manual.bairro", destination.neighborhood ?? "", { shouldDirty: false });
    setValue("recipient.manual.cidade", destination.city ?? "", { shouldDirty: false });
    setValue("recipient.manual.uf", destination.state ?? "", { shouldDirty: false });
  }, [destination, setValue]);

  // Aguarde hidratação antes de renderizar qualquer coisa
  if (!hydrated) {
    return null; // Evita flicker do alerta durante carregamento
  }

  // Se veio de RECIPIENTE (recorrente), não renderize nada (nem alerta)
  if (destination?.mode === "recipient") {
    return null;
  }

  // Se veio de MANUAL, renderize o formulário manual
  if (destination?.mode === "manual") {
    // Continua para renderizar o card abaixo
  } else {
    // Sem destino definido: mostre o alerta
    return (
      <Alert
        type="info"
        message="Destinatário não definido"
        description={
          <Space direction="vertical">
            <Typography.Text>
              Por favor, defina o destinatário na página de cotação.
            </Typography.Text>
            <Button type="link" onClick={() => router.push("/cotacoes")}>
              Voltar para Cotação
            </Button>
          </Space>
        }
        showIcon
      />
    );
  }

  return (
    <Card title="Destinatário">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          Os dados de endereço foram pré-preenchidos com base na cotação.
        </Typography.Text>

        {/* Campos editáveis */}
        <Controller
          control={control}
          name="recipient.manual.nome"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Nome completo"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
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
              required
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
              required
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
              required
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

        {/* Campos bloqueados */}
        <Controller
          control={control}
          name="recipient.manual.cep"
          render={({ field, fieldState }) => (
            <Form.Item
              label="CEP"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message || "Campo bloqueado - definido na cotação"}
              required
            >
              <Input {...field} disabled />
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
              help={fieldState.error?.message || "Campo bloqueado - definido na cotação"}
              required
            >
              <Input {...field} disabled />
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
              help={fieldState.error?.message || "Campo bloqueado - definido na cotação"}
              required
            >
              <Input {...field} disabled />
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
              help={fieldState.error?.message || "Campo bloqueado - definido na cotação"}
              required
            >
              <Input {...field} disabled />
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
              help={fieldState.error?.message || "Campo bloqueado - definido na cotação"}
              required
            >
              <Input {...field} disabled maxLength={2} />
            </Form.Item>
          )}
        />

        {/* Campos editáveis */}
        <Controller
          control={control}
          name="recipient.manual.numero"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Número"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
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
    </Card>
  );
}
