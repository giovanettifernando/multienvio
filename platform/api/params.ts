/**
 * Helpers para parsing de parâmetros de requisição
 *
 * Centraliza funções de parsing usadas em múltiplas rotas
 */

/**
 * Extrai valores de um parâmetro que pode ser:
 * - Array (múltiplos valores com mesmo nome: ?status=A&status=B)
 * - String com valores separados por vírgula (?status=A,B)
 * - Valor único (?status=A)
 *
 * @param params URLSearchParams da requisição
 * @param key Nome do parâmetro
 * @returns Array de valores únicos, trimados e não vazios
 */
export function parseArrayParam(params: URLSearchParams, key: string): string[] {
  const values = params.getAll(key);
  if (!values.length) {
    const single = params.get(key);
    if (!single) return [];
    values.push(single);
  }
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Faz parsing de um valor numérico inteiro positivo
 *
 * @param value Valor string ou null
 * @param fallback Valor padrão se inválido
 * @returns Número inteiro positivo ou fallback
 */
export function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

/**
 * Extrai parâmetros de paginação de URLSearchParams
 *
 * Suporta dois estilos:
 * - page/pageSize (paginação offset-based)
 * - limit (simples truncamento)
 *
 * @param params URLSearchParams da requisição
 * @param defaults Valores padrão opcionais
 * @returns Objeto com page, pageSize e limit
 */
export function parsePaginationParams(
  params: URLSearchParams,
  defaults?: { page?: number; pageSize?: number; limit?: number }
): { page: number; pageSize: number; limit: number | undefined } {
  const defaultPage = defaults?.page ?? 1;
  const defaultPageSize = defaults?.pageSize ?? 20;

  const page = parsePositiveInteger(params.get('page'), defaultPage);
  const pageSize = parsePositiveInteger(params.get('pageSize'), defaultPageSize);
  const limitParam = params.get('limit');
  const limit = limitParam ? parsePositiveInteger(limitParam, defaults?.limit ?? 0) : undefined;

  return { page, pageSize, limit };
}
