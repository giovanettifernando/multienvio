import type { UseFormReturn } from "react-hook-form";

export type RouteValues = {
  origem?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    nome?: string;
    email?: string;
    telefone?: string;
  } | null;
  destino?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    nome?: string;
    email?: string;
    telefone?: string;
  } | null;
  origemCep?: string | null;
  destinoCep?: string | null;
  modoOrigem?: unknown;
  modoDestino?: unknown;
  remetenteRecorrenteId?: unknown;
  destinatarioRecorrenteId?: unknown;
  [key: string]: unknown;
};

export function swapRouteValues<TFieldValues extends RouteValues>(
  form: UseFormReturn<TFieldValues>,
) {
  const current = form.getValues();
  const next = { ...(current as RouteValues) };

  const origem = (current as RouteValues).origem ?? null;
  const destino = (current as RouteValues).destino ?? null;
  next.origem = destino;
  next.destino = origem;

  const origemCep = (current as RouteValues).origemCep ?? null;
  const destinoCep = (current as RouteValues).destinoCep ?? null;
  next.origemCep = destinoCep;
  next.destinoCep = origemCep;

  const modoOrigem = (current as RouteValues).modoOrigem;
  const modoDestino = (current as RouteValues).modoDestino;
  if (modoOrigem !== undefined || modoDestino !== undefined) {
    next.modoOrigem = modoDestino;
    next.modoDestino = modoOrigem;
  }

  const remetenteRecorrenteId = (current as RouteValues).remetenteRecorrenteId;
  const destinatarioRecorrenteId = (current as RouteValues).destinatarioRecorrenteId;
  if (
    remetenteRecorrenteId !== undefined ||
    destinatarioRecorrenteId !== undefined
  ) {
    next.remetenteRecorrenteId = destinatarioRecorrenteId;
    next.destinatarioRecorrenteId = remetenteRecorrenteId;
  }

  form.reset(next as TFieldValues, {
    keepDirty: true,
    keepTouched: true,
  });
}
