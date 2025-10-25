'use client';

import { useState } from 'react';
import { Typography, Flex, App } from 'antd';
import { ClientsTable } from '@/components/admin/clients/ClientsTable';
import { ClientDrawer } from '@/components/admin/clients/ClientDrawer';
import type { AdminClient } from '@/lib/admin/types';

export default function AdminContasPage() {
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleViewClient = (client: AdminClient) => {
    setSelectedClient(client);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedClient(null);
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

        <ClientsTable onViewClient={handleViewClient} />

        <ClientDrawer open={drawerOpen} client={selectedClient} onClose={handleCloseDrawer} />
      </Flex>
    </App>
  );
}
