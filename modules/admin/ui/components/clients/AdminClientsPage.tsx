'use client';

import { useMemo, useState } from 'react';
import { App } from 'antd';
import type { AccountStatus, AdminClient } from '@/modules/admin/application/types';
import { ClientsTable } from './ClientsTable';
import { ClientDrawer } from './ClientDrawer';
import { PageShell } from '@/shared/ui/PageShell';

interface AdminClientsPageProps {
  clients: AdminClient[];
}

export function AdminClientsPage({ clients: initialClients }: AdminClientsPageProps) {
  const [clients, setClients] = useState(initialClients);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((client) => client.id === selectedClientId) ?? null;
  }, [clients, selectedClientId]);

  const handleViewClient = (client: AdminClient) => {
    setSelectedClientId(client.id);
  };

  const handleCloseDrawer = () => {
    setSelectedClientId(null);
  };

  const handleStatusChange = (id: string, status: AccountStatus) => {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, status } : client)));
  };

  const handleDelete = (id: string) => {
    setClients((prev) => prev.filter((client) => client.id !== id));
    // Se o cliente excluído estava selecionado, fechar o drawer
    if (selectedClientId === id) {
      setSelectedClientId(null);
    }
  };

  return (
    <App>
      <PageShell title="Contas de clientes" gap="md">
        <ClientsTable
          clients={clients}
          onViewClient={handleViewClient}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />

        <ClientDrawer
          open={Boolean(selectedClient)}
          client={selectedClient}
          onClose={handleCloseDrawer}
          onStatusChange={handleStatusChange}
        />
      </PageShell>
    </App>
  );
}
