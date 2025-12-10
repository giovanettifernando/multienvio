/**
 * Validadores puros (client-safe)
 *
 * Este arquivo contém funções de validação que NÃO dependem de:
 * - Prisma
 * - ApiError
 * - Qualquer módulo server-only
 *
 * Pode ser importado em Client Components sem problemas.
 */

import { onlyDigits } from "@/lib/masks";

/**
 * Regex para validar UUID v4
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Regex para validar CUID (usado pelo Prisma)
 */
const CUID_REGEX = /^c[a-z0-9]{24,}$/i;

/**
 * Verifica se uma string é um UUID válido
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Verifica se uma string é um CUID válido (formato usado pelo Prisma)
 */
export function isValidCUID(value: string): boolean {
  return CUID_REGEX.test(value);
}

/**
 * Verifica se uma string é um ID válido (UUID ou CUID)
 */
export function isValidId(value: string): boolean {
  return isValidUUID(value) || isValidCUID(value);
}

/**
 * Valida CPF
 */
export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/u.test(digits)) return false;

  const calcCheck = (slice: number) => {
    const sum = digits
      .slice(0, slice)
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * (slice + 1 - index), 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const digit1 = calcCheck(9);
  const digit2 = calcCheck(10);

  return digit1 === Number(digits[9]) && digit2 === Number(digits[10]);
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/u.test(digits)) return false;

  const calcCheck = (length: number) => {
    const slice = digits.slice(0, length);
    const factors = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = slice
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * factors[index], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const digit1 = calcCheck(12);
  const digit2 = calcCheck(13);

  return digit1 === Number(digits[12]) && digit2 === Number(digits[13]);
}

// ============================================================================
// Company helpers (client-safe)
// ============================================================================

/**
 * Tipo mínimo necessário para as funções de company
 * Evita dependência circular com company.ts
 */
interface CompanyWizardDataMinimal {
  tipoPessoa: "PF" | "PJ";
  pessoa?: { nomeCompleto?: string; cpf?: string };
  empresa?: { razao?: string; fantasia?: string; cnpj?: string };
  preferencias: { remetente?: string };
}

/**
 * Obtém nome de exibição da empresa/pessoa
 */
export function getCompanyDisplayName(company: CompanyWizardDataMinimal): string {
  const remetente = company.preferencias.remetente?.trim();
  if (remetente) return remetente;

  if (company.tipoPessoa === "PF") {
    return company.pessoa?.nomeCompleto?.trim() ?? "";
  }

  return (
    company.empresa?.fantasia?.trim() ??
    company.empresa?.razao?.trim() ??
    ""
  );
}

/**
 * Obtém documento da empresa/pessoa (CPF ou CNPJ)
 */
export function getCompanyDocument(company: CompanyWizardDataMinimal): string {
  if (company.tipoPessoa === "PF") {
    return onlyDigits(company.pessoa?.cpf ?? "");
  }
  return onlyDigits(company.empresa?.cnpj ?? "");
}
