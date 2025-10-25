"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Card, Empty, List, Skeleton, Space, Typography } from "antd";
import type { Shipment } from "@/types/shipment";
import type { Tracking } from "@/types/tracking";

type RecentTrackingProps = {
  shipments: Shipment[] | undefined;
  loading?: boolean;
};

async function fetchTrackingFor(ids: string[]): Promise<Tracking[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      const response = await fetch(`/api/tracking?shipmentId=${id}`);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as Tracking;
    }),
  );
  return results.filter(Boolean) as Tracking[];
}

export function RecentTracking({ shipments, loading }: RecentTrackingProps) {
  const latestShipments = useMemo(
    () => (shipments ?? []).slice(0, 10),
    [shipments],
  );

  const ids = useMemo(
    () => latestShipments.map((shipment) => shipment.id),
    [latestShipments],
  );

  const trackingQuery = useQuery({
    queryKey: ["dashboard", "tracking", ids],
    enabled: ids.length > 0,
    queryFn: () => fetchTrackingFor(ids),
    staleTime: 30_000,
  });

  const entries = useMemo(() => {
    if (!trackingQuery.data) return [];
    return trackingQuery.data
      .flatMap((tracking) =>
        tracking.events.slice(0, 3).map((event) => ({
          id: `${tracking.shipmentId}-${event.id}`,
          shipmentId: tracking.shipmentId,
          description: event.description,
          occurredAt: event.occurredAt,
          status: event.type,
        })),
      )
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 10);
  }, [trackingQuery.data]);

  return (
    <Card
      title="Rastreamentos recentes"
      variant="outlined"
      styles={{ body: { paddingTop: 0 } }}
    >
      {loading || trackingQuery.isLoading ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 2 }} />
        </Space>
      ) : entries.length === 0 ? (
        <Empty
          description="Nenhum evento recente"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={entries}
          renderItem={(item) => {
            const shipment = latestShipments.find((s) => s.id === item.shipmentId);
            return (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
                      {(shipment?.destinatario ?? "E")[0]}
                    </Avatar>
                  }
                  title={
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{item.description}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    shipment ? (
                      <Typography.Text type="secondary">
                        {shipment.destinatario} · {shipment.cidadeDestino}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">
                        Envio #{item.shipmentId}
                      </Typography.Text>
                    )
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
