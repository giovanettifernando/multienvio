/**
 * Wrapper para fetch que inclui o status HTTP na mensagem de erro.
 * Isso permite que o tratamento global de erros 401 funcione corretamente.
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
      errorMessage = data.message || data.error || `Request failed`;
    } catch {
      errorMessage = `Request failed`;
    }

    // Inclui o status HTTP na mensagem para que o handler global possa detectar
    const error = new Error(`${response.status}: ${errorMessage}`);
    // Adiciona propriedade status para fácil acesso
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json();
}
