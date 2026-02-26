import type { AdminClient, ClientsQuery, ClientsResponse } from '../types';

/**
 * Helper to extract data from standardized API response format { data: T, error, meta }
 */
async function extractData<T>(res: Response): Promise<T> {
  const json = await res.json();
  return (json.data ?? json) as T;
}

export async function fetchClients(params: ClientsQuery = {}): Promise<ClientsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.type && params.type !== 'all') sp.set('type', params.type);
  if (params.status && params.status !== 'all') sp.set('status', params.status);

  const res = await fetch(`/api/admin/clients?${sp.toString()}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Falha ao carregar clientes');
  return extractData<ClientsResponse>(res);
}

export async function blockAccounts(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao bloquear contas');
  return extractData<{ ok: boolean }>(res);
}

export async function unblockAccounts(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao desbloquear contas');
  return extractData<{ ok: boolean }>(res);
}

export async function updateAccount(id: string, patch: Partial<AdminClient>): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Falha ao atualizar conta');
  return extractData<{ ok: boolean }>(res);
}

export async function resetPassword(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao resetar senha');
  return extractData<{ ok: boolean }>(res);
}

export async function resendVerificationEmail(id: string): Promise<{ ok: boolean; message: string; emailSent: boolean }> {
  const res = await fetch('/api/admin/clients/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error?.message ?? 'Falha ao reenviar email de verificacao');
  }
  return extractData<{ ok: boolean; message: string; emailSent: boolean }>(res);
}

export async function deleteAccount(id: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/clients/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error?.message ?? 'Falha ao excluir conta');
  }
  return extractData<{ ok: boolean; message: string }>(res);
}
