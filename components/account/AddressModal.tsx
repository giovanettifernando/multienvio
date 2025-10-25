"use client";

import { useEffect } from "react";
import { App, Form, Input, Modal, Switch } from "antd";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CepInput } from "@/components/form/CepInput";
import type { Address } from "@/types/account";

const addressSchema = z.object({
  label: z.string().min(2, "Informe um apelido"),
  cep: z
    .string()
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP inválido."),
  logradouro: z.string().min(3, "Informe o logradouro"),
  numero: z.string().min(1, "Informe o número"),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Informe o bairro"),
  cidade: z.string().min(2, "Informe a cidade"),
  uf: z.string().min(2).max(2, "UF inválida"),
  isDefault: z.boolean(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

type AddressModalProps = {
  open: boolean;
  loading?: boolean;
  initialValues?: Partial<Address> | null;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
};

export function AddressModal({
  open,
  loading,
  initialValues,
  onSubmit,
  onCancel,
}: AddressModalProps) {
  const { message } = App.useApp();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      isDefault: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        label: initialValues?.label ?? "",
        cep: initialValues?.cep ?? "",
        logradouro: initialValues?.logradouro ?? "",
        numero: initialValues?.numero ?? "",
        complemento: initialValues?.complemento ?? "",
        bairro: initialValues?.bairro ?? "",
        cidade: initialValues?.cidade ?? "",
        uf: initialValues?.uf ?? "",
        isDefault: Boolean(initialValues?.isDefault),
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
      title={initialValues ? "Editar endereço" : "Adicionar endereço"}
    >
      <FormProvider {...form}>
        <form>
          <Controller
          name="label"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Apelido"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="Matriz, Filial, Casa..." />
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
          name="numero"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Número"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="Número" inputMode="numeric" />
            </Form.Item>
          )}
        />
        <Controller
          name="complemento"
          control={form.control}
          render={({ field }) => (
            <Form.Item label="Complemento">
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
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
              tooltip="Preenchido automaticamente pelo CEP"
            >
              <Input {...field} placeholder="Rua, Avenida" disabled />
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
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
              tooltip="Preenchido automaticamente pelo CEP"
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
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
              tooltip="Preenchido automaticamente pelo CEP"
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
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
              tooltip="Preenchido automaticamente pelo CEP"
            >
              <Input {...field} placeholder="SP" maxLength={2} style={{ width: 72 }} disabled />
            </Form.Item>
          )}
        />
        <Controller
          name="isDefault"
          control={form.control}
          render={({ field }) => (
            <Form.Item valuePropName="checked">
              <Switch
                checked={field.value}
                onChange={(checked) => field.onChange(checked)}
              />
              <span style={{ marginLeft: 8 }}>Marcar como padrão</span>
            </Form.Item>
          )}
        />
        </form>
      </FormProvider>
    </Modal>
  );
}

export default AddressModal;
