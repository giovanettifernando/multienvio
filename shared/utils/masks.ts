export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const ddd = digits.slice(0, 2);

  if (digits.length === 0) return "";
  if (digits.length <= 2) {
    return digits.replace(/(\d{0,2})/, (_match, p1) => (p1 ? `(${p1}` : ""));
  }

  if (digits.length <= 6) {
    return `(${ddd}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    const prefix = digits.slice(2, 6);
    const suffix = digits.slice(6, 10);
    return `(${ddd}) ${prefix}-${suffix}`;
  }

  const prefix = digits.slice(2, 7);
  const suffix = digits.slice(7, 11);
  return `(${ddd}) ${prefix}-${suffix}`;
}

export function maskCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return "";

  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `/${part4}`;
  if (part5) formatted += `-${part5}`;

  return formatted;
}

export function maskCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";

  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `-${part4}`;

  return formatted;
}

export function maskCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Máscara de validade de cartão no formato MM/AA — como vem impresso no
 * cartão. A API do Asaas recebe mês e ano em campos separados; a divisão é
 * responsabilidade de quem envia, não de quem digita.
 */
export function maskCardValidity(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export function normalizePhoneInput(value: string): string {
  return maskPhone(value);
}

export function normalizeCNPJInput(value: string): string {
  return maskCNPJ(value);
}

export function normalizeCPFInput(value: string): string {
  return maskCPF(value);
}

export function formatCPF(value: string): string {
  return maskCPF(value);
}

export function formatCNPJ(value: string): string {
  return maskCNPJ(value);
}

export function formatPhoneBR(value: string): string {
  return maskPhone(value);
}

export function formatCEP(value: string): string {
  return maskCEP(value);
}

export function normalizeCEPInput(value: string): string {
  return maskCEP(value);
}

/**
 * Remove máscara do CEP, retornando apenas dígitos
 * @param cep - CEP com ou sem máscara
 * @returns String com apenas 8 dígitos ou vazio se inválido
 * @example normalizeCep("12345-678") // "12345678"
 */
export function normalizeCep(cep: string | null | undefined): string {
  if (!cep) return '';
  return onlyDigits(cep).slice(0, 8);
}

/**
 * Valida se o CEP tem 8 dígitos
 * @param cep - CEP com ou sem máscara
 * @returns true se válido (8 dígitos)
 * @example isValidCep("12345-678") // true
 * @example isValidCep("1234") // false
 */
export function isValidCep(cep: string | null | undefined): boolean {
  return normalizeCep(cep).length === 8;
}
