import { onlyDigits } from "@/lib/masks";
import type { CompanyWizardData } from "./company";

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
