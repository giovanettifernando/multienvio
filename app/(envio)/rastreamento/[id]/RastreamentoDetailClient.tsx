"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  Col,
  Descriptions,
  Row,
  Typography,
} from "antd";
import type { Shipment } from "@/types/shipment";
import type { Tracking } from "@/types/tracking";
import { TrackingTimeline } from "@/components/ui/TrackingTimeline";
import { TrackingStatusTag } from "@/components/ui/TrackingStatusTag";
import { PageShell } from "@/components/shared/PageShell";
import { ELButton } from "@/components/ui/ELButton";
import { ELSkeleton } from "@/components/ui/ELSkeleton";

async function fetchShipment(id: string): Promise<Shipment> {
  const response = await fetch(`/api/shipments?id=${id}`);
  if (!response.ok) {
    throw new Error("Envio não encontrado");
  }
  const json = await response.json();
  // Handle standardized API response format { data: T, error, meta }
  const payload = json.data ?? json;
  return payload.shipment as Shipment;
}

async function fetchTracking(shipmentId: string): Promise<Tracking> {
  const response = await fetch(`/api/tracking?shipmentId=${shipmentId}`);
  if (!response.ok) {
    throw new Error("Rastreamento não encontrado");
  }
  const json = await response.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as Tracking;
}

export default function RastreamentoDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const shipmentQuery = useQuery({
    queryKey: ["shipments", id],
    queryFn: () => fetchShipment(id),
    enabled: Boolean(id),
  });

  const trackingQuery = useQuery({
    queryKey: ["tracking", id],
    queryFn: () => fetchTracking(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (shipmentQuery.isError) {
      router.replace("/rastreamento");
    }
  }, [shipmentQuery.isError, router]);

  const shipment = shipmentQuery.data;
  const tracking = trackingQuery.data;

  const isLoading = shipmentQuery.isLoading || trackingQuery.isLoading;
  const hasData = shipment && tracking;

  return (
    <PageShell title="Rastreamento do envio" gap="md">
      {isLoading ? (
        <Card variant="borderless">
          <ELSkeleton lines={6} />
        </Card>
      ) : hasData ? (
        <>
          <Card variant="borderless">
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Envio">{shipment.id}</Descriptions.Item>
              <Descriptions.Item label="Serviço">
                {shipment.servico}
              </Descriptions.Item>
              <Descriptions.Item label="Destinatário">
                {shipment.cidadeDestino}
              </Descriptions.Item>
              <Descriptions.Item label="Preço">
                {shipment.valorFrete.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <TrackingStatusTag status={tracking.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Prazo estimado">
                {shipment.prazoEstimado}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Linha do tempo" variant="borderless">
                {tracking.events.length > 0 ? (
                  <TrackingTimeline events={tracking.events} />
                ) : (
                  <Typography.Text type="secondary">
                    Nenhum evento de rastreamento registrado ainda.
                  </Typography.Text>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Ações" variant="borderless">
                <ELButton
                  variant="default"
                  onClick={() => router.push("/rastreamento")}
                  block
                >
                  Voltar para lista
                </ELButton>
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <Alert
          type="error"
          message="Não foi possível carregar o rastreamento"
          description="Verifique se o identificador está correto e tente novamente."
        />
      )}
    </PageShell>
  );
}
