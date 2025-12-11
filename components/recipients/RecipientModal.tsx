"use client";

import { useEffect } from "react";
import { App, Col, Form, Input, Row } from "antd";
import { ELModal } from "@/components/ui/ELModal";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CepInput } from "@/components/form/CepInput";
import { maskCPF, maskCNPJ, maskPhone, onlyDigits } from "@/lib/masks";
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
  notes: z.string().max(280, "Máximo de 280 caracteres").optional(),
});

export type RecipientFormValues = z.infer<typeof recipientSchema>;

type RecipientModalProps = {
  open: boolean;
  loading?: boolean;
  initialValues?: Partial<Recipient> | null;
  onSubmit: (values: RecipientFormValues) => void;
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
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      const docValue = initialValues?.doc ?? "";
      const docDigits = onlyDigits(docValue);
      const maskedDoc = docDigits.length > 11 ? maskCNPJ(docDigits) : maskCPF(docDigits);

      const phoneValue = initialValues?.phone ?? "";
      const maskedPhone = maskPhone(phoneValue);

      form.reset({
        name: initialValues?.name ?? "",
        doc: maskedDoc,
        phone: maskedPhone,
        email: initialValues?.email ?? "",
        cep: initialValues?.cep ?? "",
        logradouro: initialValues?.logradouro ?? "",
        numero: initialValues?.numero ?? "",
        complemento: initialValues?.complemento ?? "",
        bairro: initialValues?.bairro ?? "",
        cidade: initialValues?.cidade ?? "",
        uf: initialValues?.uf ?? "",
        notes: initialValues?.notes ?? "",
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
    <ELModal
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={initialValues ? "Salvar" : "Adicionar"}
      confirmLoading={loading}
      title={initialValues ? "Editar destinatário" : "Adicionar destinatário"}
      size="md"
    >
      <FormProvider {...form}>
        <div style={{ paddingTop: 16 }}>
          {/* Nome do destinatário */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              <span style={{ color: "#ff4d4f" }}>*</span> Nome do destinatário:
            </div>
            <div style={inputWrapperStyle}>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="Nome completo ou razão social" status={fieldState.error ? "error" : undefined} />
                    {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
                  </div>
                )}
              />
            </div>
          </div>

          {/* CPF/CNPJ e Telefone */}
          <div style={rowStyle}>
            <div style={labelStyle}>CPF/CNPJ:</div>
            <div style={{ width: 170 }}>
              <Controller
                name="doc"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    onChange={(e) => {
                      const digits = onlyDigits(e.target.value);
                      const masked = digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits);
                      field.onChange(masked);
                    }}
                  />
                )}
              />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>Telefone:</div>
            <div style={{ flex: 1 }}>
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                )}
              />
            </div>
          </div>

          {/* E-mail */}
          <div style={rowStyle}>
            <div style={labelStyle}>E-mail:</div>
            <div style={inputWrapperStyle}>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} type="email" placeholder="email@exemplo.com" status={fieldState.error ? "error" : undefined} />
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

          {/* Observações */}
          <div style={{ ...rowStyle, alignItems: "flex-start" }}>
            <div style={{ ...labelStyle, paddingTop: 4 }}>Observações:</div>
            <div style={inputWrapperStyle}>
              <Controller
                name="notes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input.TextArea
                      {...field}
                      rows={3}
                      maxLength={280}
                      showCount
                      placeholder="Informações adicionais (opcional)"
                      status={fieldState.error ? "error" : undefined}
                    />
                    {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </FormProvider>
    </ELModal>
  );
}
