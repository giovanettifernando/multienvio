'use client';

import { DEFAULT_CUBAGE_FACTOR } from "@/modules/quotes/ui/components/VolumesGrid";
import type { CompanyAddress, Address as StoreAddress } from "@/modules/auth/ui/state/addresses";
import type { QuoteFormValues, RouteHeaderInfo } from "./quoteFormSchema";
import { generateUUID } from "@/shared/utils/uuid";

/**
 * Keys used to compare company addresses
 */
export const companyAddressKeys: Array<keyof CompanyAddress> = [
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "nome",
  "email",
  "telefone",
];

/**
 * Compare two company addresses for equality
 */
export const addressesEqual = (
  a?: CompanyAddress | null,
  b?: CompanyAddress | null
): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return companyAddressKeys.every((key) => (a[key] ?? "") === (b[key] ?? ""));
};

/**
 * Convert an address to header display info
 */
export const toHeaderInfo = (
  addr: StoreAddress | null | undefined | {
    id: string;
    cidade: string;
    uf: string;
    cep: string;
    logradouro?: string;
    numero?: string;
    apelido?: string;
    isDefault?: boolean;
  }
): RouteHeaderInfo => {
  if (!addr) return null;
  const apelido = 'apelido' in addr ? addr.apelido : undefined;
  return {
    cidade: addr.cidade,
    uf: addr.uf,
    label: apelido ?? `${addr.logradouro || ''}, ${addr.numero || ''}`,
    cep: addr.cep,
    isDefault: addr.isDefault ?? false,
  };
};

/**
 * Cria um volume vazio.
 *
 * Os campos numéricos nascem `undefined`, não `0`: com zero, o formulário abria
 * com "0" digitado em todos os campos — o usuário tinha que apagar antes de
 * escrever, e o texto de dica com o mínimo nunca aparecia. Com `undefined` o
 * campo fica realmente vazio e mostra a dica (`mín. 10`, `mín. 15`...).
 *
 * O cast existe porque o schema de validação exige números (o volume só é
 * válido preenchido), mas o formulário legitimamente passa por um estado vazio
 * antes de o usuário digitar. O grid já trata `undefined` (`value ?? undefined`)
 * e a validação acusa o campo vazio normalmente no envio.
 */
export const createEmptyVolume = (): QuoteFormValues["volumes"][number] => ({
  id: generateUUID(),
  comprimentoCm: undefined as unknown as number,
  larguraCm: undefined as unknown as number,
  alturaCm: undefined as unknown as number,
  pesoKg: undefined as unknown as number,
});

/**
 * Compute totals for volumes (real weight and cubed weight)
 */
export const computeTotals = (volumes: QuoteFormValues["volumes"] | undefined) => {
  if (!volumes?.length) {
    return { pesoRealKg: 0, pesoCubadoKg: 0 };
  }
  return volumes.reduce(
    (acc, volume) => {
      const comprimento = Number(volume.comprimentoCm) || 0;
      const largura = Number(volume.larguraCm) || 0;
      const altura = Number(volume.alturaCm) || 0;
      const peso = Number(volume.pesoKg) || 0;
      const cubado =
        comprimento && largura && altura
          ? (comprimento * largura * altura) / DEFAULT_CUBAGE_FACTOR
          : 0;
      return {
        pesoRealKg: acc.pesoRealKg + peso,
        pesoCubadoKg: acc.pesoCubadoKg + cubado,
      };
    },
    { pesoRealKg: 0, pesoCubadoKg: 0 }
  );
};

/**
 * Dispatch a telemetry event
 */
export const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

/**
 * Map store address to company address format
 */
export const mapStoreAddressToCompany = (
  address: StoreAddress | {
    id: string;
    cidade: string;
    uf: string;
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    apelido?: string;
    isDefault?: boolean;
  } | null | undefined
): CompanyAddress | null => {
  if (!address) return null;
  const apelido = 'apelido' in address ? address.apelido : undefined;
  return {
    cep: address.cep,
    logradouro: address.logradouro,
    numero: address.numero,
    complemento: address.complemento,
    bairro: address.bairro,
    cidade: address.cidade,
    uf: address.uf,
    nome: apelido,
  };
};
