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
        title="Destinatário não definido"
        description={
          <Space orientation="vertical">
            <Typography.Text>
              Por favor, defina o destinatário na página de cotação.
            </Typography.Text>
            <Button type="link" onClick={() => {
              sessionStorage.setItem("preserveQuoteState", "1");
              router.push("/cotacoes");
            }}>
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
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          Os dados de endereço foram pré-preenchidos com base na cotação.
        </Typography.Text>

        {/* 1. Nome completo */}
        <Controller
          control={control}
          name="recipient.manual.nome"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Nome completo"
              htmlFor="recipient-nome"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-nome" placeholder="Nome do destinatário" prefix={<UserOutlined />} />
            </Form.Item>
          )}
        />

        {/* 2. Telefone */}
        <Controller
          control={control}
          name="recipient.manual.telefone"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Telefone"
              htmlFor="recipient-telefone"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input
                {...field}
                id="recipient-telefone"
                placeholder="(00) 00000-0000"
                prefix={<PhoneOutlined />}
                onChange={(event) =>
                  field.onChange(maskPhone(event.target.value))
                }
              />
            </Form.Item>
          )}
        />

        {/* 3. E-mail */}
        <Controller
          control={control}
          name="recipient.manual.email"
          render={({ field, fieldState }) => (
            <Form.Item
              label="E-mail"
              htmlFor="recipient-email"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-email" type="email" placeholder="email@exemplo.com" prefix={<MailOutlined />} />
            </Form.Item>
          )}
        />

        {/* 4. CPF/CNPJ */}
        <Controller
          control={control}
          name="recipient.manual.documento"
          render={({ field, fieldState }) => (
            <Form.Item
              label="CPF/CNPJ"
              htmlFor="recipient-documento"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input
                {...field}
                id="recipient-documento"
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

        {/* 5. Número */}
        <Controller
          control={control}
          name="recipient.manual.numero"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Número"
              htmlFor="recipient-numero"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-numero" placeholder="Número" />
            </Form.Item>
          )}
        />

        {/* 6. Complemento (opcional) */}
        <Controller
          control={control}
          name="recipient.manual.complemento"
          render={({ field }) => (
            <Form.Item label="Complemento" htmlFor="recipient-complemento" style={{ marginBottom: 12 }}>
              <Input {...field} id="recipient-complemento" placeholder="Apartamento, bloco, etc." />
            </Form.Item>
          )}
        />

        {/* 7. Observações (opcional) */}
        <Controller
          control={control}
          name="recipient.manual.observacoes"
          render={({ field }) => (
            <Form.Item label="Observações" htmlFor="recipient-observacoes" style={{ marginBottom: 12 }}>
              <Input.TextArea
                {...field}
                id="recipient-observacoes"
                placeholder="Referências de entrega, horários, etc."
                rows={3}
              />
            </Form.Item>
          )}
        />

        {/* 8. CEP (bloqueado) */}
        <Controller
          control={control}
          name="recipient.manual.cep"
          render={({ field, fieldState }) => (
            <Form.Item
              label="CEP"
              htmlFor="recipient-cep"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-cep" disabled />
            </Form.Item>
          )}
        />

        {/* 9. Logradouro (bloqueado) */}
        <Controller
          control={control}
          name="recipient.manual.logradouro"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Logradouro"
              htmlFor="recipient-logradouro"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-logradouro" disabled />
            </Form.Item>
          )}
        />

        {/* 10. Bairro (bloqueado) */}
        <Controller
          control={control}
          name="recipient.manual.bairro"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Bairro"
              htmlFor="recipient-bairro"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-bairro" disabled />
            </Form.Item>
          )}
        />

        {/* 11. Cidade (bloqueado) */}
        <Controller
          control={control}
          name="recipient.manual.cidade"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Cidade"
              htmlFor="recipient-cidade"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-cidade" disabled />
            </Form.Item>
          )}
        />

        {/* 12. UF (bloqueado) */}
        <Controller
          control={control}
          name="recipient.manual.uf"
          render={({ field, fieldState }) => (
            <Form.Item
              label="UF"
              htmlFor="recipient-uf"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 12 }}
            >
              <Input {...field} id="recipient-uf" disabled maxLength={2} />
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
