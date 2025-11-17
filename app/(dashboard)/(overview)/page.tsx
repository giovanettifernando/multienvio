"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Flex, Space, Typography, Row, Col, Grid } from "antd";
import { PageShell } from "@/components/shared/PageShell";
import { QuickCalculator } from "@/components/dashboard/QuickCalculator";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { ShipmentsStatusBoard } from "@/components/dashboard/ShipmentsStatusBoard";
import { ShipmentsCostTrend } from "@/components/dashboard/ShipmentsCostTrend";
import { WalletRecent } from "@/components/dashboard/WalletRecent";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { SupportQuickView } from "@/components/dashboard/SupportQuickView";
import { PickupSchedule } from "@/components/dashboard/PickupSchedule";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DashboardFooterLinks } from "@/components/dashboard/DashboardFooterLinks";
import { computeDashboardKpis } from "@/lib/dashboard/stats";
import type { Order } from "@/types/order";
import type { Shipment } from "@/types/shipment";

const { useBreakpoint } = Grid;

type OrdersResponse = {
  dados: Order[];
};

type ShipmentsResponse = {
  dados: Shipment[];
};

async function fetchOrders(): Promise<Order[]> {
  const response = await fetch("/api/orders");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os pedidos.");
  }
  const data = (await response.json()) as OrdersResponse;
  return data.dados ?? [];
}

async function fetchShipments(): Promise<Shipment[]> {
  const response = await fetch("/api/shipments");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios.");
  }
  const data = (await response.json()) as ShipmentsResponse;
  return data.dados ?? [];
}

export default function OverviewPage() {
  const screens = useBreakpoint();

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    staleTime: 90_000,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipments"],
    queryFn: fetchShipments,
    staleTime: 90_000,
  });

  const kpiItems = useMemo(
    () => computeDashboardKpis(ordersQuery.data ?? [], shipmentsQuery.data ?? []),
    [ordersQuery.data, shipmentsQuery.data],
  );

  // Add wallet KPI dynamically
  const allKpis = [...kpiItems];

  return (
    <PageShell title="Painel de Controle" gap="md">
      {/* Errors Display */}
      {ordersQuery.isError && (
        <Alert
          type="error"
          message="Não foi possível carregar os dados de pedidos."
          showIcon
          closable
        />
      )}
      {shipmentsQuery.isError && (
        <Alert
          type="error"
          message="Não foi possível carregar os envios."
          showIcon
          closable
        />
      )}

      {/* Row 1: KPIs principais + Saldo da carteira */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={24} md={24} lg={18} xl={18}>
          <KpiCards
            loading={ordersQuery.isLoading || shipmentsQuery.isLoading}
            items={allKpis}
          />
        </Col>
        <Col xs={24} sm={24} md={24} lg={6} xl={6}>
          <WalletCard />
        </Col>
      </Row>

      {/* Row 2: Gráfico Volume x Custo */}
      <Row gutter={[12, 12]}>
        <Col xs={24}>
          <ShipmentsCostTrend
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
            months={6}
          />
        </Col>
      </Row>

      {/* Row 3: Status de envios + Calculadora */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={24} md={24} lg={16} xl={16}>
          <ShipmentsStatusBoard
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
          />
        </Col>
        <Col xs={24} sm={24} md={24} lg={8} xl={8}>
          <QuickCalculator />
        </Col>
      </Row>

      {/* Row 4: Transações da carteira + Tickets de suporte */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <WalletRecent />
        </Col>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <SupportQuickView />
        </Col>
      </Row>

      {/* Row 5: Coletas agendadas + Alertas */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <PickupSchedule />
        </Col>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <AlertsPanel />
        </Col>
      </Row>

      {/* Footer Links */}
      <DashboardFooterLinks />
    </PageShell>
  );
}
