'use client';

import { useMemo, useState } from 'react';
import { App, Flex, Typography } from 'antd';
import type { AccountStatus, AdminClient } from '@/lib/admin/types';
import { ClientsTable } from './ClientsTable';
import { ClientDrawer } from './ClientDrawer';

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

  return (
    <App>
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 0 }}>
            Contas de clientes
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Gerencie contas de clientes (PF/PJ), aprove KYC, bloqueie/desbloqueie e edite limites
          </Typography.Paragraph>
        </div>

        <ClientsTable
          clients={clients}
          onViewClient={handleViewClient}
          onStatusChange={handleStatusChange}
        />

        <ClientDrawer
          open={Boolean(selectedClient)}
          client={selectedClient}
          onClose={handleCloseDrawer}
          onStatusChange={handleStatusChange}
        />
      </Flex>
    </App>
  );
}
