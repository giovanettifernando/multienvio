/**
 * Wrapper para fetch que inclui o status HTTP na mensagem de erro.
 * Isso permite que o tratamento global de erros 401 funcione corretamente.
 *
 * Também extrai automaticamente o campo `data` de respostas padronizadas
 * no formato { data: T, error: null, meta: {...} }
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    // Tenta extrair mensagem do body
    let errorMessage: string;
    try {
      const data = await response.json();
      errorMessage = data.error?.message || data.message || data.error || `Request failed`;
    } catch {
      errorMessage = `Request failed`;
    }

    // Inclui o status HTTP na mensagem para que o handler global possa detectar
    const error = new Error(`${response.status}: ${errorMessage}`);
    // Adiciona propriedade status para fácil acesso
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const json = await response.json();

  // Handle standardized API response format { data: T, error, meta }
  if (json && typeof json === 'object' && 'data' in json && json.data !== undefined) {
    return json.data as T;
  }

  return json as T;
}
