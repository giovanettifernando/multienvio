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
 * Formata a descrição de uma transação da carteira
 * @param raw - Descrição bruta da transação
 * @returns Descrição formatada para exibição
 */
export function formatWalletDescription(raw: string | null): string {
  if (!raw) return '';

  // Substituir descrições técnicas por texto amigável
  if (raw.includes('cart_payment')) {
    return 'Pagamento de multiplos envios pelo carrinho';
  }

  return raw;
}
