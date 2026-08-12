"use client";

import { useEffect } from "react";
import { useELApp, ELInput } from '@/shared/ui';
const App = { useApp: useELApp };
const Input = ELInput;
import { ELModal } from '@/shared/ui/ELModal';
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CepInput } from '@/shared/ui/form/CepInput';
import type { Address } from '@/shared/types/account';

const addressSchema = z.object({
  label: z.string().min(2, "Informe um apelido"),
  cep: z
    .string()
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP inválido."),
  logradouro: z.string().min(3, "Informe o logradouro"),
  numero: z.string(),
  // Marcado quando o endereço não tem número (a rua não numera, imóvel rural
  // etc.). Nesse caso o campo `numero` é preenchido com "S/N", que é o que as
  // transportadoras esperam receber — enviar vazio faz a etiqueta sair sem
  // número e a entrega falhar.
  semNumero: z.boolean().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Informe o bairro"),
  cidade: z.string().min(2, "Informe a cidade"),
  uf: z.string().min(2).max(2, "UF inválida"),
}).superRefine((valores, ctx) => {
  // Número só é obrigatório quando "sem número" NÃO está marcado.
  if (!valores.semNumero && valores.numero.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["numero"],
      message: "Informe o número",
    });
  }
});

export type AddressFormValues = z.infer<typeof addressSchema>;

type AddressModalProps = {
  open: boolean;
  loading?: boolean;
  initialValues?: Partial<Address> | null;
  onSubmit: (values: AddressFormValues) => void;
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
      semNumero: false,
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
        // Endereço salvo como "S/N" reabre com a caixinha já marcada.
        semNumero: (initialValues?.numero ?? "").trim().toUpperCase() === "S/N",
        complemento: initialValues?.complemento ?? "",
        bairro: initialValues?.bairro ?? "",
        cidade: initialValues?.cidade ?? "",
        uf: initialValues?.uf ?? "",
      });
    }
  }, [open, initialValues, form]);

  // Observado para o campo de número reagir na hora: some o asterisco,
  // desabilita o input e mostra "S/N".
  const semNumero = form.watch("semNumero");

  const handleSubmit = form.handleSubmit((values) => {
    // "S/N" é o que vai para a etiqueta e para a transportadora quando o
    // endereço não tem número.
    onSubmit(values.semNumero ? { ...values, numero: "S/N" } : values);
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
      title={initialValues ? "Editar endereço" : "Adicionar endereço"}
      size="md"
    >
      <FormProvider {...form}>
        <div style={formStyle}>

          {/* Apelido */}
          <div>
            <label style={fieldLabel}><span style={{ color: "#ff4d4f" }}>*</span> Apelido</label>
            <Controller name="label" control={form.control} render={({ field, fieldState }) => (
              <div>
                <Input {...field} placeholder="Matriz, Filial, Casa..." status={fieldState.error ? "error" : undefined} />
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
            <div style={{ width: 130 }}>
              <label style={fieldLabel}>
                {!semNumero && <span style={{ color: "#ff4d4f" }}>*</span>} Número
              </label>
              <Controller name="numero" control={form.control} render={({ field, fieldState }) => (
                <div>
                  <Input
                    {...field}
                    value={semNumero ? "S/N" : field.value}
                    disabled={semNumero}
                    placeholder="123"
                    inputMode="numeric"
                    status={fieldState.error ? "error" : undefined}
                  />
                  {fieldState.error && (
                    <div style={{ color: "#ff4d4f", fontSize: 12 }}>{fieldState.error.message}</div>
                  )}
                </div>
              )} />
              <Controller name="semNumero" control={form.control} render={({ field }) => (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    fontSize: 12,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(field.value)}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      // Limpa o que estava digitado ao marcar, e revalida para
                      // apagar um erro de "informe o número" que já estivesse
                      // na tela.
                      if (e.target.checked) form.setValue("numero", "");
                      void form.trigger("numero");
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  Sem número
                </label>
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

        </div>
      </FormProvider>
    </ELModal>
  );
}

export default AddressModal;
