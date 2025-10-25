"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Typography,
} from "antd";
import type { Pickup, PickupStatus } from "@/types/pickup";
import { PickupStatusTag } from "@/components/ui/PickupStatusTag";
import { PickupTimeline } from "@/components/ui/PickupTimeline";

async function fetchPickup(id: string): Promise<Pickup> {
  const response = await fetch(`/api/pickups/${id}`);
  if (!response.ok) {
    throw new Error("Coleta não encontrada");
  }
  return response.json();
}

const STATUS_OPTIONS = [
  { label: "Agendada", value: "SCHEDULED" },
  { label: "Motorista atribuído", value: "ASSIGNED" },
  { label: "Coletada", value: "PICKED_UP" },
  { label: "Falha", value: "FAILED" },
  { label: "Cancelada", value: "CANCELED" },
];

const WEBHOOK_OPTIONS = [
  { label: "Agendada", value: "scheduled" },
  { label: "Motorista atribuído", value: "assigned" },
  { label: "Coletada", value: "picked_up" },
  { label: "Falha", value: "failed" },
  { label: "Cancelada", value: "canceled" },
];

export default function PickupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pickupQuery = useQuery({
    queryKey: ["pickup", id],
    queryFn: () => fetchPickup(id),
  });

  const updateStatusMutation = useMutation<void, Error, { status: PickupStatus; description?: string }>({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/pickups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível atualizar o status da coleta");
      }
    },
  });

  const webhookMutation = useMutation<void, Error, { code: string; description: string }>({
    mutationFn: async (payload) => {
      const response = await fetch("/api/webhooks/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // se o seu webhook exige o ID da coleta, inclua aqui:
          // pickupId: id,
          ...payload,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Falha ao simular webhook de coleta");
      }
    },
    // opcional: refetch da própria coleta se você usa useQuery pra ela
    // onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pickups', id] }),
  });


  const manifestMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`/api/pickups/${id}/manifest`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Falha ao gerar manifesto");
      }
    },
  });


  useEffect(() => {
    if (pickupQuery.isError) {
      router.replace("/coletas");
    }
  }, [pickupQuery.isError, router]);

  if (pickupQuery.isLoading) {
    return (
      <Card variant="borderless">
        <Typography.Text>Carregando dados…</Typography.Text>
      </Card>
    );
  }

  const pickup = pickupQuery.data;

  if (!pickup) {
    return (
      <Alert
        message="Coleta não encontrada"
        description="Verifique o identificador e tente novamente."
        type="error"
      />
    );
  }

  return (
    <Flex vertical gap={24}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Coleta {pickup.id}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Acompanhe os eventos e documentos desta coleta.
        </Typography.Paragraph>
      </Space>

      <Card variant="borderless">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Status">
            <PickupStatusTag status={pickup.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Agendamento">
            {pickup.schedule.date} · {pickup.schedule.windowStart} -
            {" "}
            {pickup.schedule.windowEnd}
          </Descriptions.Item>
          <Descriptions.Item label="Transportadora">
            {pickup.carrierPref ?? "Qualquer"}
          </Descriptions.Item>
          <Descriptions.Item label="Envios">
            {pickup.totals.count} itens ·
            {" "}
            {pickup.totals.weightKg.toFixed(2)} kg
          </Descriptions.Item>
          <Descriptions.Item label="Manifesto">
            {pickup.manifest ? (
              <Button
                type="link"
                href={pickup.manifest.pdfUrl}
                target="_blank"
              >
                Baixar manifesto
              </Button>
            ) : (
              <Button
                onClick={() => manifestMutation.mutate()}
                loading={manifestMutation.isPending}
              >
                Gerar manifesto
              </Button>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Flex gap={24} align="start" wrap>
        <Card title="Eventos" variant="borderless" style={{ flex: 1 }}>
          <PickupTimeline events={pickup.events} />
        </Card>

        <Space direction="vertical" style={{ width: 320 }} size={24}>
          <Card title="Atualizar status" variant="borderless">
            <Form
              layout="vertical"
              onFinish={(values: { status: PickupStatus; description?: string }) =>
                updateStatusMutation.mutate(values)
              }
            >
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
              <Form.Item name="description" label="Descrição">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={updateStatusMutation.isPending}>
                Atualizar
              </Button>
            </Form>
          </Card>

          <Card title="Simular webhook" variant="borderless">
            <Form
              layout="vertical"
              onFinish={(values: { code: string; description: string }) =>
                webhookMutation.mutate(values)
              }
            >
              <Form.Item name="code" label="Status" rules={[{ required: true }]}
              >
                <Select options={WEBHOOK_OPTIONS} />
              </Form.Item>
              <Form.Item name="description" label="Descrição" rules={[{ required: true }]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button htmlType="submit" loading={webhookMutation.isPending}>
                Simular
              </Button>
            </Form>
          </Card>
        </Space>
      </Flex>
    </Flex>
  );
}
