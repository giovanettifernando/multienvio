/**
 * Pure utility functions for packaging - safe for client and server
 * No database imports - these are just formatting utilities
 */

/**
 * Formata um número removendo zeros desnecessários
 */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Gera nome automático no formato C (xx) x L (xx) x A (xx)
 */
export function generateAutoName(lengthCm: number, widthCm: number, heightCm: number): string {
  const length = formatNumber(lengthCm);
  const width = formatNumber(widthCm);
  const height = formatNumber(heightCm);
  return `C (${length}) x L (${width}) x A (${height})`;
}

/**
 * Formata nome da embalagem: usa nome customizado ou gera baseado em dimensões
 */
export function formatPackagingName(params: {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  name?: string | null;
}): string {
  if (params.name) return params.name;
  return generateAutoName(params.lengthCm, params.widthCm, params.heightCm);
}
