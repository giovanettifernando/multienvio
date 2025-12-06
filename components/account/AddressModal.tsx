"use client";

import { useEffect } from "react";
import { App, Input, Modal } from "antd";
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
});

export type AddressFormValues = z.infer<typeof addressSchema>;

type AddressModalProps = {
  open: boolean;
  loading?: boolean;
  initialValues?: Partial<Address> | null;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
};

// Estilos para layout horizontal
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 16,
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  minWidth: 130,
  textAlign: "right",
  lineHeight: "32px",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const inputWrapperStyle: React.CSSProperties = {
  flex: 1,
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
      width={640}
    >
      <FormProvider {...form}>
        <div style={{ paddingTop: 16 }}>
          {/* Apelido */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Apelido:
            </div>
            <div style={inputWrapperStyle}>
              <Controller
                name="label"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="Matriz, Filial, Casa..." status={fieldState.error ? "error" : undefined} />
                    {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
                  </div>
                )}
              />
            </div>
          </div>

          {/* CEP */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> CEP:
            </div>
            <div style={inputWrapperStyle}>
              <CepInput
                name="cep"
                label=""
                required
                targets={{
                  city: "cidade",
                  state: "uf",
                  street: "logradouro",
                  neighborhood: "bairro",
                }}
              />
            </div>
          </div>

          {/* Logradouro */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Logradouro:
            </div>
            <div style={inputWrapperStyle}>
              <Controller
                name="logradouro"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="Rua, Avenida, etc." disabled status={fieldState.error ? "error" : undefined} />
                    {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
                  </div>
                )}
              />
            </div>
          </div>

          {/* Número e Complemento */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Número:
            </div>
            <div style={{ width: 80 }}>
              <Controller
                name="numero"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input {...field} placeholder="123" inputMode="numeric" status={fieldState.error ? "error" : undefined} />
                )}
              />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>Complemento:</div>
            <div style={{ flex: 1 }}>
              <Controller
                name="complemento"
                control={form.control}
                render={({ field }) => (
                  <Input {...field} placeholder="Apto, sala, etc. (opcional)" />
                )}
              />
            </div>
          </div>

          {/* Bairro */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Bairro:
            </div>
            <div style={inputWrapperStyle}>
              <Controller
                name="bairro"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="Bairro" disabled status={fieldState.error ? "error" : undefined} />
                    {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
                  </div>
                )}
              />
            </div>
          </div>

          {/* Cidade e UF */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Cidade:
            </div>
            <div style={{ flex: 1 }}>
              <Controller
                name="cidade"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input {...field} placeholder="Cidade" disabled status={fieldState.error ? "error" : undefined} />
                )}
              />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "#ff4d4f" }}>*</span> UF:
            </div>
            <div style={{ width: 60 }}>
              <Controller
                name="uf"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input {...field} placeholder="SP" maxLength={2} disabled status={fieldState.error ? "error" : undefined} />
                )}
              />
            </div>
          </div>
        </div>
      </FormProvider>
    </Modal>
  );
}

export default AddressModal;
