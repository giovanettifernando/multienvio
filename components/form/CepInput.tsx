"use client";
import { Input, Form, Spin } from "antd";
import { useController, useFormContext } from "react-hook-form";
import { useRef, useState } from "react";

type CepV2Response = {
  cep: string;
  state: string;
  city: string;
  neighborhood?: string | null;
  street?: string | null;
};

function normalizeCep(v: string) {
  return (v || "").replace(/\D/g, "").slice(0, 8);
}
function maskCep(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));
}
async function fetchCepV2(rawCep: string): Promise<CepV2Response> {
  const cep = normalizeCep(rawCep);
  if (cep.length !== 8) throw new Error("CEP inválido");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!r.ok) {
      if (r.status === 404) throw new Error("CEP não encontrado");
      if (r.status === 429) throw new Error("Muitas consultas — tente novamente");
      throw new Error("Falha ao consultar CEP");
    }
    const data = (await r.json()) as CepV2Response;
    if (!data?.state || !data?.city) throw new Error("Resposta incompleta");
    return data;
  } finally {
    clearTimeout(t);
  }
}

type Props = {
  /** Nome do campo de CEP no RHF (ex.: "endereco.cep") */
  name: string;
  label?: string;
  /** Mapeamento dos campos derivados no formulário atual */
  targets?: {
    city: string;          // ex.: "endereco.cidade"
    state: string;         // ex.: "endereco.uf"
    street?: string;       // ex.: "endereco.logradouro"
    neighborhood?: string; // ex.: "endereco.bairro"
  };
};

export function CepInput({ name, label = "CEP", targets }: Props) {
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
      if (targets?.state) setValue(targets.state, data.state.toUpperCase(), { shouldDirty: true, shouldValidate: true });
      if (targets?.city) setValue(targets.city, data.city, { shouldDirty: true, shouldValidate: true });
      if (targets?.street && data.street) {
        setValue(targets.street, data.street, { shouldDirty: true, shouldValidate: true });
      }
      if (targets?.neighborhood && data.neighborhood) {
        setValue(targets.neighborhood, data.neighborhood, { shouldDirty: true, shouldValidate: true });
      }

      lastResolvedCep.current = cepDigits;
    } catch (e: unknown) {
      const error = e as { message?: string };
      setLookupError(error?.message || "Erro ao consultar CEP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form.Item
      label={label}
      validateStatus={fieldState.error || lookupError ? "error" : undefined}
      help={fieldState.error?.message || lookupError || undefined}
    >
      <Input
        {...field}
        value={field.value ?? ""}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00000-000"
        maxLength={9}
        inputMode="numeric"
        autoComplete="postal-code"
        suffix={loading ? <Spin size="small" /> : null}
      />
    </Form.Item>
  );
}
