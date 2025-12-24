"use client";

import { useQuery } from "@tanstack/react-query";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELGrid } from '@/shared/ui/ELGrid';
import { PageShell } from '@/shared/ui/PageShell';
import { QuickCalculator } from '@/modules/dashboard/ui/components/QuickCalculator';
import { ShipmentsStatusBoard } from '@/modules/dashboard/ui/components/ShipmentsStatusBoard';
import { ShipmentsSummaryCard } from '@/modules/dashboard/ui/components/ShipmentsSummaryCard';
import { WalletUnified } from '@/modules/dashboard/ui/components/WalletUnified';
import { PickupSchedule } from '@/modules/dashboard/ui/components/PickupSchedule';
import { PendingPickupPointShipments } from '@/modules/dashboard/ui/components/PendingPickupPointShipments';
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

      {/* Row 1: Status de envios (filas ativas) + Resumo (entregues/cancelados) */}
      <ELGrid variant="dashboard" gap="md">
        <ShipmentsStatusBoard
          shipments={shipmentsQuery.data ?? []}
          loading={shipmentsQuery.isLoading}
        />
        <ShipmentsSummaryCard
          shipments={shipmentsQuery.data ?? []}
          loading={shipmentsQuery.isLoading}
        />
      </ELGrid>

      {/* Row 2: Calculadora | Carteira | Coletas agendadas */}
      <ELGrid variant="3" gap="md">
        <QuickCalculator />
        <WalletUnified />
        <PickupSchedule />
      </ELGrid>

      {/* Row 3: Envios pendentes em pontos de coleta */}
      <PendingPickupPointShipments />
    </PageShell>
  );
}
