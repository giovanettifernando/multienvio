"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Card,
  Col,
  Descriptions,
  Form,
  Row,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import type { PickupRequestDetail, PickupStatus, PickupAttemptNote } from "@/lib/types/pickup";
import { PickupStatusTag } from "@/components/ui/PickupStatusTag";
import { PickupTimeline } from "@/components/ui/PickupTimeline";
import { PageShell } from "@/components/shared/PageShell";
import { ELButton } from "@/components/ui/ELButton";
import { ELSelect } from "@/components/ui/ELSelect";
import { ELInput } from "@/components/ui/ELInput";

async function fetchPickup(id: string): Promise<PickupRequestDetail> {
  const response = await fetch(`/api/coletas/${id}`);
  if (!response.ok) {
    throw new Error("Coleta não encontrada");
  }
  const json = await response.json();
  // Handle standardized API response format { data: T, error, meta }
  return (json.data ?? json) as PickupRequestDetail;
}

const STATUS_OPTIONS = [
  { label: "Pendente", value: "PENDING" },
  { label: "Agendada", value: "SCHEDULED" },
  { label: "Concluída", value: "COMPLETED" },
  { label: "Falhou", value: "FAILED" },
  { label: "Cancelada", value: "CANCELED" },
];

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PickupDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const pickupQuery = useQuery({
    queryKey: ["pickup", id],
    queryFn: () => fetchPickup(id),
  });

  const updateStatusMutation = useMutation<void, Error, { status: PickupStatus; notes?: string }>({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/coletas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.message ?? "Não foi possível atualizar o status da coleta");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
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

  // Parse attemptNotes
  const attempts: PickupAttemptNote[] = Array.isArray(pickup.attemptNotes)
    ? pickup.attemptNotes
    : [];

  const trackingCode = pickup.shipment?.platformTrackingCode ?? "—";
  const carrier = pickup.shipment?.carrier ?? "—";
  const service = pickup.shipment?.service ?? "—";

  return (
    <PageShell
      title={`Coleta #${pickup.id.slice(-8)}`}
      gap="md"
    >
      <Card variant="borderless">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="Status">
            <PickupStatusTag status={pickup.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Código do Envio">
            <Link href={`/shipments/${pickup.shipmentId}`} style={{ fontWeight: 500 }}>
              {trackingCode}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Transportadora">
            {carrier}
          </Descriptions.Item>
          <Descriptions.Item label="Serviço">
            {service}
          </Descriptions.Item>
          <Descriptions.Item label="Janela de Coleta">
            {pickup.windowStart && pickup.windowEnd
              ? `${formatDate(pickup.windowStart)} até ${formatDate(pickup.windowEnd)}`
              : "Não definida"}
          </Descriptions.Item>
          <Descriptions.Item label="Data Agendada">
            {formatDate(pickup.scheduleAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Coletor">
            {pickup.collector?.name ?? "Não atribuído"}
          </Descriptions.Item>
          <Descriptions.Item label="Tentativas">
            {pickup.attemptCount}
          </Descriptions.Item>
          <Descriptions.Item label="Endereço de Origem" span={2}>
            {[
              pickup.originAddress,
              pickup.originCity,
              pickup.originUf,
              pickup.originCep,
            ].filter(Boolean).join(", ") || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Destinatário">
            {pickup.shipment?.recipientName ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="CEP Destino">
            {pickup.shipment?.destinationCep ?? "—"}
          </Descriptions.Item>
          {pickup.collectedAt && (
            <Descriptions.Item label="Coletado em">
              {formatDate(pickup.collectedAt)}
              {pickup.collectedBy && ` por ${pickup.collectedBy}`}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Observações" span={2}>
            {pickup.notes || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Criado em">
            {formatDateShort(pickup.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Atualizado em">
            {formatDateShort(pickup.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="Histórico" variant="borderless">
            <PickupTimeline
              attempts={attempts}
              createdAt={pickup.createdAt}
              status={pickup.status}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Atualizar Status" variant="borderless">
            <Form
              layout="vertical"
              onFinish={(values: { status: PickupStatus; notes?: string }) =>
                updateStatusMutation.mutate(values)
              }
            >
              <Form.Item name="status" label="Novo Status" rules={[{ required: true, message: "Selecione um status" }]}>
                <ELSelect options={STATUS_OPTIONS} placeholder="Selecione o status" />
              </Form.Item>
              <Form.Item name="notes" label="Observações">
                <ELInput.TextArea rows={3} placeholder="Adicione uma observação (opcional)" />
              </Form.Item>
              <Space>
                <ELButton
                  variant="primary"
                  htmlType="submit"
                  loading={updateStatusMutation.isPending}
                >
                  Atualizar
                </ELButton>
                <ELButton variant="default" onClick={() => router.push("/coletas")}>
                  Voltar
                </ELButton>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </PageShell>
  );
}
