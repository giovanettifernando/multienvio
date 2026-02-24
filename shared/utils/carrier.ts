/**
 * Utilitários de identificação de transportadora.
 */

/** Termos que identificam Correios (case-insensitive, via includes) */
export const CORREIOS_CARRIERS = ['correios', 'sedex', 'pac', 'mini envios'] as const;

/**
 * Verifica se a transportadora é dos Correios.
 *
 * Aceita variações como "Correios", "SEDEX", "PAC", "Mini Envios", etc.
 */
export function isCorreiosCarrier(carrier: string | null): boolean {
  if (!carrier) return false;
  const normalized = carrier.toLowerCase().trim();
  return CORREIOS_CARRIERS.some((c) => normalized.includes(c));
}
