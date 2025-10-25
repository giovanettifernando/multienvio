"use client";

import { useEffect } from "react";
import { App, Form, Input, Modal, Switch } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const cardSchema = z.object({
  holderName: z.string().min(3, "Informe o nome impresso no cartão"),
  number: z.string().regex(/^\d{13,19}$/u, "Número de cartão inválido"),
  exp: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/(\d{2})$/u, "Validade inválida (MM/AA)"),
  cvv: z.string().regex(/^\d{3,4}$/u, "CVV inválido"),
  document: z.string().min(11, "Informe o CPF/CNPJ"),
  isPrimary: z.boolean(),
});

export type CardFormValues = z.infer<typeof cardSchema>;

type CardModalProps = {
  open: boolean;
  loading?: boolean;
  onSubmit: (values: CardFormValues) => void;
  onCancel: () => void;
};

export function CardModal({ open, loading, onSubmit, onCancel }: CardModalProps) {
  const { message } = App.useApp();

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      holderName: "",
      number: "",
      exp: "",
      cvv: "",
      document: "",
      isPrimary: false,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
  }, () => {
    message.error("Revise os campos do cartão.");
  });

  return (
    <Modal
      open={open}
      title="Adicionar cartão"
      okText="Adicionar"
      confirmLoading={loading}
      onOk={handleSubmit}
      onCancel={onCancel}
    >
      <form>
        <Controller
          name="holderName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Nome impresso"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="Nome impresso" />
            </Form.Item>
          )}
        />
        <Controller
          name="number"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Número do cartão"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} inputMode="numeric" maxLength={19} placeholder="0000000000000000" />
            </Form.Item>
          )}
        />
        <Controller
          name="exp"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="Validade (MM/AA)"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="MM/AA" maxLength={5} />
            </Form.Item>
          )}
        />
        <Controller
          name="cvv"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="CVV"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} inputMode="numeric" maxLength={4} placeholder="CVV" />
            </Form.Item>
          )}
        />
        <Controller
          name="document"
          control={form.control}
          render={({ field, fieldState }) => (
            <Form.Item
              label="CPF/CNPJ do titular"
              required
              validateStatus={fieldState.error ? "error" : ""}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="Documento" />
            </Form.Item>
          )}
        />
        <Controller
          name="isPrimary"
          control={form.control}
          render={({ field }) => (
            <Form.Item valuePropName="checked">
              <Switch
                checked={field.value}
                onChange={(checked) => field.onChange(checked)}
              />
              <span style={{ marginLeft: 8 }}>Definir como principal</span>
            </Form.Item>
          )}
        />
      </form>
    </Modal>
  );
}

export default CardModal;
