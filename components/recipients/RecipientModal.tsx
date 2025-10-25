"use client";

import { useEffect } from "react";
import { App, Form, Input, Modal } from "antd";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CepInput } from "@/components/form/CepInput";
import type { Recipient } from "@/lib/state/recipients";

const recipientSchema = z.object({
  name: z.string().min(2, "Informe o nome do destinatário"),
  doc: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cep: z
    .string()
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP inválido."),
  logradouro: z.string().min(3, "Informe o logradouro"),
  numero: z.string().min(1, "Informe o número"),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Informe o bairro"),
  cidade: z.string().min(2, "Informe a cidade"),
  uf: z.string().min(2).max(2, "UF inválida"),
});

export type RecipientFormValues = z.infer<typeof recipientSchema>;

type RecipientModalProps = {
  open: boolean;
  loading?: boolean;
  initialValues?: Partial<Recipient> | null;
  onSubmit: (values: RecipientFormValues) => void;
  onCancel: () => void;
};

export function RecipientModal({
  open,
  loading,
  initialValues,
  onSubmit,
  onCancel,
}: RecipientModalProps) {
  const { message } = App.useApp();

  const form = useForm<RecipientFormValues>({
    resolver: zodResolver(recipientSchema),
    defaultValues: {
      name: "",
      doc: "",
      phone: "",
      email: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initialValues?.name ?? "",
        doc: initialValues?.doc ?? "",
        phone: initialValues?.phone ?? "",
        email: initialValues?.email ?? "",
        cep: initialValues?.cep ?? "",
        logradouro: initialValues?.logradouro ?? "",
        numero: initialValues?.numero ?? "",
        complemento: initialValues?.complemento ?? "",
        bairro: initialValues?.bairro ?? "",
        cidade: initialValues?.cidade ?? "",
        uf: initialValues?.uf ?? "",
      });
    }
  }, [open, initialValues, form]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
  }, (errors) => {
    if (errors && Object.keys(errors).length) {
      message.error("Revise os campos destacados.");
    }
  });

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={initialValues ? "Salvar" : "Adicionar"}
      confirmLoading={loading}
      title={initialValues ? "Editar destinatário" : "Adicionar destinatário"}
      width={600}
    >
      <FormProvider {...form}>
        <form>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nome do destinatário"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Nome completo ou razão social" />
              </Form.Item>
            )}
          />

          <CepInput
            name="cep"
            label="CEP"
            targets={{
              city: "cidade",
              state: "uf",
              street: "logradouro",
              neighborhood: "bairro",
            }}
          />

          <Controller
            name="doc"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="CPF/CNPJ"
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Opcional" />
              </Form.Item>
            )}
          />

          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Telefone"
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Opcional" />
              </Form.Item>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="E-mail"
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} type="email" placeholder="Opcional" />
              </Form.Item>
            )}
          />

          <Controller
            name="numero"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Número"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="123" />
              </Form.Item>
            )}
          />

          <Controller
            name="complemento"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Complemento"
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Apto, sala, etc. (opcional)" />
              </Form.Item>
            )}
          />

          <Controller
            name="logradouro"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Logradouro"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Rua, Avenida, etc." disabled />
              </Form.Item>
            )}
          />

          <Controller
            name="bairro"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Bairro"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Bairro" disabled />
              </Form.Item>
            )}
          />

          <Controller
            name="cidade"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Cidade"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Cidade" disabled />
              </Form.Item>
            )}
          />

          <Controller
            name="uf"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="UF"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="SP" maxLength={2} style={{ width: 72 }} disabled />
              </Form.Item>
            )}
          />
        </form>
      </FormProvider>
    </Modal>
  );
}
