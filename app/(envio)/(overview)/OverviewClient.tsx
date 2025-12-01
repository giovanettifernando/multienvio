"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Row, Col } from "antd";
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
        <Alert
          type="error"
          message="Não foi possível carregar os envios."
          showIcon
          closable
        />
      )}

      {/* Row 1: Status de envios (filas ativas) + Resumo (entregues/cancelados) */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <ShipmentsStatusBoard
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <ShipmentsSummaryCard
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
          />
        </Col>
      </Row>

      {/* Row 2: Calculadora + Carteira | Transações + Suporte */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12} lg={8}>
          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <QuickCalculator />
            </Col>
            <Col xs={24}>
              <WalletCard />
            </Col>
          </Row>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <WalletRecent />
        </Col>
        <Col xs={24} md={24} lg={8}>
          <SupportQuickView />
        </Col>
      </Row>

      {/* Row 4: Coletas agendadas + Envios pendentes em pontos de coleta */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <PickupSchedule />
        </Col>
        <Col xs={24} md={12}>
          <PendingPickupPointShipments />
        </Col>
      </Row>
    </PageShell>
  );
}
