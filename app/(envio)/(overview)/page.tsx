"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Row, Col } from "antd";
import { PageShell } from "@/components/shared/PageShell";
import { QuickCalculator } from "@/components/dashboard/QuickCalculator";
import { ShipmentsStatusBoard } from "@/components/dashboard/ShipmentsStatusBoard";
import { WalletRecent } from "@/components/dashboard/WalletRecent";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { SupportQuickView } from "@/components/dashboard/SupportQuickView";
import { PickupSchedule } from "@/components/dashboard/PickupSchedule";
import { PendingPickupPointShipments } from "@/components/dashboard/PendingPickupPointShipments";
import { DashboardFooterLinks } from "@/components/dashboard/DashboardFooterLinks";
import type { Shipment } from "@/types/shipment";

type ShipmentsResponse = {
  dados: Shipment[];
};

async function fetchShipments(): Promise<Shipment[]> {
  const response = await fetch("/api/shipments");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios.");
  }
  const data = (await response.json()) as ShipmentsResponse;
  return data.dados ?? [];
}

export default function OverviewPage() {
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

      {/* Row 1: Status de envios */}
      <Row gutter={[12, 12]}>
        <Col xs={24}>
          <ShipmentsStatusBoard
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
          />
        </Col>
      </Row>

      {/* Row 2: Calculadora + Carteira | Transações Recentes */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12} lg={10}>
          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <QuickCalculator />
            </Col>
            <Col xs={24}>
              <WalletCard />
            </Col>
          </Row>
        </Col>
        <Col xs={24} md={12} lg={14}>
          <WalletRecent />
        </Col>
      </Row>

      {/* Row 3: Suporte */}
      <Row gutter={[12, 12]}>
        <Col xs={24}>
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

      {/* Footer Links */}
      <DashboardFooterLinks />
    </PageShell>
  );
}
