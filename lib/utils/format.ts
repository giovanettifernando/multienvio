/**
 * Formata um número como moeda brasileira (BRL)
 * @param value - Valor numérico a ser formatado
 * @returns String formatada como R$ 0,00
 * @example
 * formatBRL(1234.56) // "R$ 1.234,56"
 * formatBRL(0) // "R$ 0,00"
 * formatBRL(null) // "—"
 * formatBRL(undefined) // "—"
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Parser para InputNumber Ant Design - remove formatação BRL
 * @param value - String formatada (ex: "R$ 1.234,56")
 * @returns Número parseado ou undefined
 */
export function parseBRL(value: string | undefined): number | undefined {
  if (!value) return undefined;

  // Remove R$, espaços e pontos de milhar
  const cleaned = value.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);

  return Number.isNaN(parsed) ? undefined : parsed;
}
