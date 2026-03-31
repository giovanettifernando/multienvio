"use client";

import { useEffect } from "react";
import { ELApp, ELForm, ELInput } from "@/shared/ui";
const App = ELApp;
const Form = ELForm;
const Input = ELInput;
import { ELModal } from '@/shared/ui/ELModal';
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CepInput } from '@/shared/ui/form/CepInput';
import { maskCPF, maskCNPJ, maskPhone, onlyDigits } from "@/shared/utils/masks";
import type { Recipient } from "@/modules/recipients/ui/state/recipients";

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

const formStyle: React.CSSProperties = {
  padding: "16px 15px 0",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#374151",
  marginBottom: 4,
  display: "block",
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
        <div style={formStyle}>

          {/* Nome do destinatário */}
          <div>
            <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Nome do destinatário</label>
            <Controller name="name" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input {...field} placeholder="Nome completo ou razão social" status={fieldState.error ? "error" : undefined} />
                {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
              </div>
            )} />
          </div>

          {/* CPF/CNPJ e Telefone */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>CPF/CNPJ</label>
              <Controller name="doc" control={form.control} render={({ field }) => (
                <Input {...field} placeholder="000.000.000-00" inputMode="numeric"
                  onChange={(e) => { const d = onlyDigits(e.target.value); field.onChange(d.length > 11 ? maskCNPJ(d) : maskCPF(d)); }} />
              )} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Telefone</label>
              <Controller name="phone" control={form.control} render={({ field }) => (
                <Input {...field} placeholder="(00) 00000-0000" inputMode="tel"
                  onChange={(e) => field.onChange(maskPhone(e.target.value))} />
              )} />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label style={fieldLabel}>E-mail</label>
            <Controller name="email" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input {...field} type="email" placeholder="email@exemplo.com" status={fieldState.error ? "error" : undefined} />
                {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
              </div>
            )} />
          </div>

          {/* CEP */}
          <div>
            <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> CEP</label>
            <CepInput name="cep" label="" required targets={{ city: "cidade", state: "uf", street: "logradouro", neighborhood: "bairro" }} />
          </div>

          {/* Logradouro */}
          <div>
            <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Logradouro</label>
            <Controller name="logradouro" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input {...field} placeholder="Rua, Avenida, etc." disabled status={fieldState.error ? "error" : undefined} />
                {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
              </div>
            )} />
          </div>

          {/* Número e Complemento */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 100 }}>
              <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Número</label>
              <Controller name="numero" control={form.control} render={({ field, fieldState }) => (
                <Input {...field} placeholder="123" inputMode="numeric" status={fieldState.error ? "error" : undefined} />
              )} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Complemento</label>
              <Controller name="complemento" control={form.control} render={({ field }) => (
                <Input {...field} placeholder="Apto, sala, etc. (opcional)" />
              )} />
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Bairro</label>
            <Controller name="bairro" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input {...field} placeholder="Bairro" disabled status={fieldState.error ? "error" : undefined} />
                {fieldState.error && <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>}
              </div>
            )} />
          </div>

          {/* Cidade e UF */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Cidade</label>
              <Controller name="cidade" control={form.control} render={({ field, fieldState }) => (
                <Input {...field} placeholder="Cidade" disabled status={fieldState.error ? "error" : undefined} />
              )} />
            </div>
            <div style={{ width: 70 }}>
              <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> UF</label>
              <Controller name="uf" control={form.control} render={({ field, fieldState }) => (
                <Input {...field} placeholder="SP" maxLength={2} disabled status={fieldState.error ? "error" : undefined} />
              )} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={fieldLabel}>Observações</label>
            <Controller name="notes" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input.TextArea {...field} rows={3} maxLength={280} placeholder="Informações adicionais (opcional)" status={fieldState.error ? "error" : undefined} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  {fieldState.error ? <span style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</span> : <span />}
                  <span style={{ color: '#98A2B3', fontSize: 12 }}>{(field.value?.length ?? 0)} / 280</span>
                </div>
              </div>
            )} />
          </div>

        </div>
      </FormProvider>
    </ELModal>
  );
}
