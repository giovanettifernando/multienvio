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

/**
 * SINGLETON: Formatter para moeda BRL (evita criar novo Intl.NumberFormat a cada chamada)
 */
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Formata valor como moeda BRL usando formatter singleton (otimizado)
 * @param value - Valor em reais
 * @returns String formatada (ex: "R$ 1.234,56")
 */
export function formatBRL(value: number): string {
  return currencyFormatter.format(value);
}

/**
 * Formata valor em centavos como moeda BRL
 * @param cents - Valor em centavos
 * @returns String formatada (ex: "R$ 12,34")
 */
export function formatCentsAsBRL(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/**
 * Interface para parâmetros de paginação
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parseia parâmetros de paginação de URLSearchParams
 * @param searchParams - URLSearchParams da request
 * @param defaults - Valores padrão opcionais
 * @returns Objeto com page, pageSize, skip e take
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; pageSize?: number } = {}
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? String(defaults.page ?? 1), 10));
  const pageSize = Math.min(
    100, // Limite máximo
    Math.max(1, parseInt(searchParams.get('pageSize') ?? searchParams.get('limit') ?? String(defaults.pageSize ?? 10), 10))
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
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
