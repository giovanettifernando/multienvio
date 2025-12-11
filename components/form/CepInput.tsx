"use client";

import { Input, Form, Spin } from "antd";
import { useController, useFormContext } from "react-hook-form";
import { useRef, useState } from "react";
import {
  fetchCepV2,
  normalizeCep,
  type CepError,
} from "@/lib/services/brasilapi";

function maskCep(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));
}

type Props = {
  /** Nome do campo de CEP no RHF (ex.: "endereco.cep") */
  name: string;
  label?: string;
  /** Marca o campo como obrigatório (exibe asterisco) */
  required?: boolean;
  /** Mapeamento dos campos derivados no formulário atual */
  targets?: {
    city: string;          // ex.: "endereco.cidade"
    state: string;         // ex.: "endereco.uf"
    street?: string;       // ex.: "endereco.logradouro"
    neighborhood?: string; // ex.: "endereco.bairro"
  };
};

export function CepInput({ name, label = "CEP", required, targets }: Props) {
  const { control, setValue } = useFormContext();
  const { field, fieldState } = useController({ control, name });
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lastResolvedCep = useRef<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setLookupError(null);
    // NÃO consultar aqui; apenas atualizar o valor digitado
    field.onChange(masked);
  };

  const handleBlur = async () => {
    field.onBlur();
    const cepDigits = normalizeCep(field.value);
    if (cepDigits.length !== 8) return;                // só consulta com 8 dígitos
    if (lastResolvedCep.current === cepDigits) return; // evita reconsulta

    setLoading(true);
    setLookupError(null);
    try {
      const data = await fetchCepV2(cepDigits);

      // Preenche apenas derivados (nunca reescreve o próprio CEP)
      if (targets?.state && data.state) {
        setValue(targets.state, data.state.toUpperCase(), { shouldDirty: true, shouldValidate: true });
      }
      if (targets?.city && data.city) {
        setValue(targets.city, data.city, { shouldDirty: true, shouldValidate: true });
      }
      if (targets?.street && data.street) {
        setValue(targets.street, data.street, { shouldDirty: true, shouldValidate: true });
      }
      if (targets?.neighborhood && data.neighborhood) {
        setValue(targets.neighborhood, data.neighborhood, { shouldDirty: true, shouldValidate: true });
      }

      lastResolvedCep.current = cepDigits;
    } catch (e: unknown) {
      const error = e as CepError;
      setLookupError(error?.message || "Erro ao consultar CEP");
    } finally {
      setLoading(false);
    }
  };

  const inputElement = (
    <Input
      {...field}
      value={field.value ?? ""}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="00000-000"
      maxLength={9}
      inputMode="numeric"
      autoComplete="postal-code"
      suffix={<Spin size="small" style={{ visibility: loading ? "visible" : "hidden" }} />}
      status={fieldState.error || lookupError ? "error" : undefined}
    />
  );

  // Se label vazio, retorna apenas o input com erro inline
  if (!label) {
    return (
      <div>
        {inputElement}
        {(fieldState.error?.message || lookupError) && (
          <div style={{ color: "#ff4d4f", fontSize: 12 }}>
            {fieldState.error?.message || lookupError}
          </div>
        )}
      </div>
    );
  }

  return (
    <Form.Item
      label={label}
      required={required}
      validateStatus={fieldState.error || lookupError ? "error" : undefined}
      help={fieldState.error?.message || lookupError || undefined}
    >
      {inputElement}
    </Form.Item>
  );
}
