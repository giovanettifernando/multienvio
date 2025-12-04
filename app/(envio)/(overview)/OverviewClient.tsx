"use client";

import { useQuery } from "@tanstack/react-query";
import { ELAlert } from "@/components/ui/ELAlert";
import { ELGrid, ELFlex } from "@/components/ui/ELGrid";
import { PageShell } from "@/components/shared/PageShell";
import { QuickCalculator } from "@/components/dashboard/QuickCalculator";
import { ShipmentsStatusBoard } from "@/components/dashboard/ShipmentsStatusBoard";
import { ShipmentsSummaryCard } from "@/components/dashboard/ShipmentsSummaryCard";
import { WalletRecent } from "@/components/dashboard/WalletRecent";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { SupportQuickView } from "@/components/dashboard/SupportQuickView";
import { PickupSchedule } from "@/components/dashboard/PickupSchedule";
import { PendingPickupPointShipments } from "@/components/dashboard/PendingPickupPointShipments";

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
  const response = await fetch("/api/shipments?limit=100");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios.");
  }
  const data = (await response.json()) as ShipmentsResponse;
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

      {/* Row 2: Calculadora + Carteira | Transações + Suporte */}
      <ELGrid variant="3" gap="md">
        <ELFlex direction="col" gap="md">
          <QuickCalculator />
          <WalletCard />
        </ELFlex>
        <WalletRecent />
        <SupportQuickView />
      </ELGrid>

      {/* Row 3: Coletas agendadas + Envios pendentes em pontos de coleta */}
      <ELGrid variant="2" gap="md">
        <PickupSchedule />
        <PendingPickupPointShipments />
      </ELGrid>
    </PageShell>
  );
}
