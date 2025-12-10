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

/**
 * Formatter para InputNumber Ant Design - formata número para padrão brasileiro
 * Usado com decimalSeparator="," para exibir valores como "1.234,56"
 * @param value - Valor numérico ou string
 * @returns String formatada com separador de milhar (ponto)
 * @example
 * inputNumberFormatterBRL(1234.56) // "1.234,56"
 * inputNumberFormatterBRL("1234.56") // "1.234,56"
 */
export function inputNumberFormatterBRL(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '';

  // Converte para string e garante que temos um número válido
  const numStr = String(value);

  // Separa parte inteira e decimal
  const parts = numStr.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1] || '';

  // Adiciona separador de milhar (ponto) na parte inteira
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Retorna com vírgula como separador decimal se houver decimais
  return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
}

/**
 * Parser para InputNumber Ant Design - converte string formatada para número
 * Usado com decimalSeparator="," para parsear valores como "1.234,56"
 * @param value - String formatada (ex: "1.234,56")
 * @returns Número parseado
 * @example
 * inputNumberParserBRL("1.234,56") // 1234.56
 */
export function inputNumberParserBRL(value: string | undefined): number {
  if (!value) return 0;

  // Remove pontos de milhar e converte vírgula decimal para ponto
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);

  return Number.isNaN(parsed) ? 0 : parsed;
}
