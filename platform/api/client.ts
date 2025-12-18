/**
 * API Client utilities for frontend
 *
 * Handles the standardized API response format: { data, error, meta }
 */

export interface ApiResponse<T> {
  data: T;
  error: null | { code: string; message: string };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Fetch data from API and extract the data field
 * Throws if response is not ok or if there's an error in the response
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error?.message || json.message || 'Erro na requisição');
  }

  // Handle standardized API response format
  // The API returns { data: ..., error: null, meta: ... }
  if (json.data !== undefined) {
    return json.data as T;
  }

  // Fallback for non-standardized responses
  return json as T;
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  url: string,
  body: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  url: string,
  body: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'DELETE',
    ...options,
  });
}
