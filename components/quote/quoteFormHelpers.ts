import { DEFAULT_CUBAGE_FACTOR } from "@/components/quote/VolumesGrid";
import type { CompanyAddress, Address as StoreAddress } from "@/lib/state/addresses";
import type { QuoteFormValues, RouteHeaderInfo } from "./quoteFormSchema";
import { generateUUID } from "@/lib/utils/uuid";

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
 * Create an empty volume object
 */
export const createEmptyVolume = (): QuoteFormValues["volumes"][number] => ({
  id: generateUUID(),
  comprimentoCm: 0,
  larguraCm: 0,
  alturaCm: 0,
  pesoKg: 0,
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
