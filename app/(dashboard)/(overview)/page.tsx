"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Flex, Skeleton, Space, Typography } from "antd";
import { QuickQuote } from "@/components/dashboard/QuickQuote";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { OrdersRecentTable } from "@/components/dashboard/OrdersRecentTable";
import { RecentTracking } from "@/components/dashboard/RecentTracking";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { PerformanceCarrier } from "@/components/dashboard/PerformanceCarrier";
import { DashboardFooterLinks } from "@/components/dashboard/DashboardFooterLinks";
import { computeDashboardKpis } from "@/lib/dashboard/stats";
import type { Order } from "@/types/order";
import type { Shipment } from "@/types/shipment";

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
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    staleTime: 60_000,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipments"],
    queryFn: fetchShipments,
    staleTime: 60_000,
  });

  const kpiItems = useMemo(
    () => computeDashboardKpis(ordersQuery.data ?? [], shipmentsQuery.data ?? []),
    [ordersQuery.data, shipmentsQuery.data],
  );

  return (
    <Flex vertical gap={24}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Olá, bem-vindo ao seu painel 👋
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Acompanhe performance, alertas e inicie ações operacionais em poucos cliques.
        </Typography.Paragraph>
      </Space>

      <Flex gap={24} wrap align="stretch">
        <div style={{ flex: "2 1 520px", minWidth: 320 }}>
          {ordersQuery.isError ? (
            <Card variant="outlined">
              <Alert
                type="error"
                message="Não foi possível carregar os dados de pedidos."
                showIcon
              />
            </Card>
          ) : shipmentsQuery.isError ? (
            <Card variant="outlined">
              <Alert
                type="error"
                message="Não foi possível carregar os envios."
                showIcon
              />
            </Card>
          ) : null}
          <QuickQuote />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 260 }}>
          <QuickActions />
        </div>
      </Flex>

      <KpiCards
        loading={ordersQuery.isLoading || shipmentsQuery.isLoading}
        items={kpiItems}
      />

      <Flex gap={24} wrap align="stretch">
        <Card
          title="Últimos pedidos"
          variant="outlined"
          styles={{ body: { paddingTop: 0 } }}
          style={{ flex: "2 1 520px", minWidth: 320 }}
        >
          {ordersQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <OrdersRecentTable
              orders={ordersQuery.data ?? []}
              loading={ordersQuery.isLoading}
            />
          )}
        </Card>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <RecentTracking
            shipments={shipmentsQuery.data ?? []}
            loading={shipmentsQuery.isLoading}
          />
        </div>
      </Flex>

      <Flex gap={24} wrap align="stretch">
        <div style={{ flex: "1 1 360px", minWidth: 280 }}>
          <AlertsPanel />
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <WalletCard />
        </div>
      </Flex>

      <PerformanceCarrier shipments={shipmentsQuery.data ?? []} />

      <DashboardFooterLinks />
    </Flex>
  );
}
