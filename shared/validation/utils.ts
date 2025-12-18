import { onlyDigits } from "@/shared/utils/masks";
import { ApiError } from "@/platform/api/errors";
import type { CompanyWizardData } from "./company";

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
 * Valida um parâmetro de rota como ID e lança ApiError se inválido
 * @param id - O valor do parâmetro de rota
 * @param paramName - Nome do parâmetro para mensagem de erro (default: "id")
 * @returns O ID validado
 * @throws ApiError se o ID for inválido
 */
export function validateIdParam(id: string | undefined, paramName = "id"): string {
  if (!id || typeof id !== "string") {
    throw new ApiError({
      code: "validation_error",
      message: `${paramName} é obrigatório`,
      status: 400,
    });
  }

  if (!isValidId(id)) {
    throw new ApiError({
      code: "validation_error",
      message: `${paramName} inválido`,
      status: 400,
    });
  }

  return id;
}

/**
 * Valida múltiplos parâmetros de rota como IDs
 * @param params - Objeto com parâmetros de rota
 * @param paramNames - Lista de nomes de parâmetros para validar
 * @returns Objeto com IDs validados
 * @throws ApiError se algum ID for inválido
 */
export function validateIdParams<T extends Record<string, string>>(
  params: T,
  paramNames: (keyof T)[]
): T {
  for (const name of paramNames) {
    validateIdParam(params[name], String(name));
  }
  return params;
}

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

export function getCompanyDisplayName(company: CompanyWizardData): string {
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

export function getCompanyDocument(company: CompanyWizardData): string {
  if (company.tipoPessoa === "PF") {
    return onlyDigits(company.pessoa?.cpf ?? "");
  }
  return onlyDigits(company.empresa?.cnpj ?? "");
}
