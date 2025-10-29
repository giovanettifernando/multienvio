/**
 * Remove todos os caracteres não numéricos
 */
export function unmaskDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Máscara para CNPJ: 00.000.000/0000-00
 */
export function maskCNPJ(value: string): string {
  const digits = unmaskDigits(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Máscara básica para telefone (DDD + número)
 */
export function maskPhone(value: string): string {
  const digits = unmaskDigits(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Máscara para placa Mercosul (AAA0A00)
 */
export function maskPlateMercosul(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 7);
}

/**
 * Máscara para CEP brasileiro
 */
export function maskCEP(value: string): string {
  const digits = unmaskDigits(value);

  if (digits.length <= 5) return digits;

  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}
/**
 * Máscara para CPF: 000.000.000-00
 */
export function maskCPF(value: string): string {
  const digits = unmaskDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}
