/**
 * Helpers de formatação numérica e monetária seguindo padrão brasileiro
 * Separador de milhar: ponto (.)
 * Separador decimal: vírgula (,)
 */

/**
 * Formata um valor numérico como moeda brasileira (R$)
 * @param value - Valor numérico em reais
 * @returns String formatada com R$ (ex: "R$ 1.234,56")
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata um número seguindo padrão brasileiro (sem símbolo de moeda)
 * @param value - Valor numérico
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada (ex: "1.234,56")
 */
export function formatNumberBR(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata um valor com sinal de crédito/débito
 * @param value - Valor em reais
 * @param isCredit - Se é crédito (true) ou débito (false)
 * @returns String formatada com sinal (ex: "+ R$ 100,00" ou "- R$ 50,00")
 */
export function formatSignedCurrency(value: number, isCredit: boolean): string {
  const absoluteValue = Math.abs(value);
  const formatted = formatCurrencyBRL(absoluteValue);
  const sign = isCredit ? '+' : '-';
  return `${sign} ${formatted}`;
}
