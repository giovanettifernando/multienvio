/**
 * Utilidades para manipulação de strings
 */

/**
 * Remove acentos e normaliza string para comparação case-insensitive
 * @param str String para normalizar
 * @returns String normalizada
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se uma string contém outra (case-insensitive, sem acentos)
 * @param text Texto onde buscar
 * @param query Texto a buscar
 * @returns true se encontrou
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true;
  return normalizeString(text).includes(normalizeString(query));
}

/**
 * Cria função debounce para limitar execução
 * @param fn Função a executar
 * @param delay Delay em ms
 * @returns Função com debounce
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
