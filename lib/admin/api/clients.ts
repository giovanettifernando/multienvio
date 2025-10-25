import type { AdminClient, ClientsQuery, ClientsResponse } from '../types';

export async function fetchClients(params: ClientsQuery = {}): Promise<ClientsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.type && params.type !== 'all') sp.set('type', params.type);
  if (params.status && params.status !== 'all') sp.set('status', params.status);

  const res = await fetch(`/api/admin/clients?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar clientes');
  return res.json();
}

export async function blockAccounts(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao bloquear contas');
  return res.json();
}

export async function unblockAccounts(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao desbloquear contas');
  return res.json();
}

export async function updateAccount(id: string, patch: Partial<AdminClient>): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Falha ao atualizar conta');
  return res.json();
}

export async function resetPassword(ids: string[]): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/clients/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Falha ao resetar senha');
  return res.json();
}
