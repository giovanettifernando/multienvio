"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import type { Shipment } from "@/types/shipment";
import type { Tracking, TrackingEventType } from "@/types/tracking";
import { TrackingTimeline } from "@/components/ui/TrackingTimeline";
import { TrackingStatusTag } from "@/components/ui/TrackingStatusTag";

async function fetchShipment(id: string): Promise<Shipment> {
  const response = await fetch(`/api/shipments?id=${id}`);
  if (!response.ok) {
    throw new Error("Envio não encontrado");
  }
  const payload = await response.json();
  return payload.shipment as Shipment;
}

async function fetchTracking(shipmentId: string): Promise<Tracking> {
  const response = await fetch(`/api/tracking?shipmentId=${shipmentId}`);
  if (!response.ok) {
    throw new Error("Rastreamento não encontrado");
  }
  return response.json();
}

const EVENT_OPTIONS: Array<{ label: string; value: TrackingEventType }> = [
  { label: "Criado", value: "CREATED" },
  { label: "Coletado", value: "PICKED_UP" },
  { label: "Em trânsito", value: "IN_TRANSIT" },
  { label: "Saiu para entrega", value: "OUT_FOR_DELIVERY" },
  { label: "Entregue", value: "DELIVERED" },
  { label: "Atrasado", value: "DELAYED" },
  { label: "Ocorrência", value: "ISSUE" },
];

export default function TrackingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

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

const addEventMutation = useMutation<void, Error, {
  shipmentId: string;
  type: TrackingEventType;
  description: string;
  city?: string;
  uf?: string;
}>({
  mutationFn: async (payload) => {
    const response = await fetch("/api/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.mensagem ?? "Não foi possível adicionar o evento");
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["tracking", id] });
  },
});


const webhookMutation = useMutation<void, Error, {
  shipmentId: string;
  code: string;
  description: string;
  city?: string;
  uf?: string;
}>({
  mutationFn: async (payload) => {
    const response = await fetch("/api/webhooks/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.mensagem ?? "Não foi possível simular o webhook");
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["tracking", id] });
  },
});

  useEffect(() => {
    if (shipmentQuery.isError) {
      router.replace("/rastreamento");
    }
  }, [shipmentQuery.isError, router]);

  const shipment = shipmentQuery.data;
  const tracking = trackingQuery.data;

  return (
    <Flex vertical gap={24}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Rastreamento do envio
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Acompanhe os eventos registrados para este envio.
        </Typography.Paragraph>
      </Space>

      {shipmentQuery.isLoading || trackingQuery.isLoading ? (
        <Card variant="borderless">
          <Typography.Text>Carregando dados…</Typography.Text>
        </Card>
      ) : shipment && tracking ? (
        <>
          <Card variant="borderless">
            <Descriptions column={2} bordered size="small">
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

          <Flex gap={24} align="start" wrap>
            <Card title="Linha do tempo" variant="borderless" style={{ flex: 1 }}>
              <TrackingTimeline events={tracking.events} />
            </Card>

            <Space direction="vertical" style={{ width: 320 }} size={24}>
              <Card title="Adicionar evento" variant="borderless">
                <Form
                  layout="vertical"
                  onFinish={(values: {
                    type: TrackingEventType;
                    description: string;
                    city?: string;
                    uf?: string;
                  }) =>
                    addEventMutation.mutate({
                      shipmentId: id,
                      ...values,
                    })
                  }
                >
                  <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>           
                    <Select options={EVENT_OPTIONS} placeholder="Selecione" />
                  </Form.Item>
                  <Form.Item
                    name="description"
                    label="Descrição"
                    rules={[{ required: true, message: "Informe a descrição" }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={14}>
                      <Form.Item name="city" label="Cidade">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={10}>
                      <Form.Item name="uf" label="UF">
                        <Input maxLength={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={addEventMutation.isPending}
                    block
                  >
                    Adicionar evento
                  </Button>
                </Form>
              </Card>

              <Card title="Simular webhook" variant="borderless">
                <Form
                  layout="vertical"
                  onFinish={(values: {
                    code: TrackingEventType;
                    description: string;
                    city?: string;
                    uf?: string;
                  }) =>
                    webhookMutation.mutate({
                      shipmentId: id,
                      ...values,
                    })
                  }
                >
                  <Form.Item name="code" label="Status" rules={[{ required: true }]}
                  >
                    <Select options={EVENT_OPTIONS} placeholder="Selecione" />
                  </Form.Item>
                  <Form.Item
                    name="description"
                    label="Descrição"
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={14}>
                      <Form.Item name="city" label="Cidade">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={10}>
                      <Form.Item name="uf" label="UF">
                        <Input maxLength={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button
                    htmlType="submit"
                    loading={webhookMutation.isPending}
                    block
                  >
                    Disparar webhook
                  </Button>
                </Form>
              </Card>
            </Space>
          </Flex>
        </>
      ) : (
        <Alert
          type="error"
          message="Não foi possível carregar o rastreamento"
          description="Verifique se o identificador está correto e tente novamente."
        />
      )}
    </Flex>
  );
}
