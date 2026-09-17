"use client";

import { useQuery } from "@tanstack/react-query";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELGrid } from '@/shared/ui/ELGrid';
import { PageShell } from '@/shared/ui/PageShell';
import { QuickCalculator } from '@/modules/dashboard/ui/components/QuickCalculator';
import { ShipmentsStatusBoard } from '@/modules/dashboard/ui/components/ShipmentsStatusBoard';
import { WalletUnified } from '@/modules/dashboard/ui/components/WalletUnified';
import { apiFetch } from "@/shared/utils/api-fetch";

interface ShipmentItem {
  id: string;
  status: string;
  createdAt: string;
}

interface ShipmentsResponse {
  items: ShipmentItem[];
  pagination: {
    total: number;
  };
}

async function fetchShipments(): Promise<ShipmentItem[]> {
  const data = await apiFetch<ShipmentsResponse>("/api/shipments?limit=100");
  return data.items ?? [];
}

export default function OverviewClient() {
  const shipmentsQuery = useQuery({
    queryKey: ["shipments"],
    queryFn: fetchShipments,
    staleTime: 90_000,
  });

  return (
    <PageShell title="Painel de Controle" gap="md">
      {/* Errors Display */}
      {shipmentsQuery.isError && (
        <ELAlert
          type="error"
          message="Não foi possível carregar os envios."
          showIcon
          closable
        />
      )}

      {/* Row 1: Status de envios unificado */}
      <ShipmentsStatusBoard
        shipments={shipmentsQuery.data ?? []}
        loading={shipmentsQuery.isLoading}
      />

      <ELGrid variant="3" gap="md">
        <QuickCalculator />
        <WalletUnified />
      </ELGrid>
    </PageShell>
  );
}
