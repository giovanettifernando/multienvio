"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  "Aguardando coleta": "Aguardando coleta",
  Postado: "Postado",
  "Em trânsito": "Em trânsito",
  "Em rota de entrega": "Em rota de entrega",
  Entregue: "Entregue",
  Cancelado: "Cancelado",
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useShipments();
  const shipment = (data?.items ?? []).find((s: Shipment) => s.id === id);

  return (
    <Flex vertical gap={24}>
      <Space align="center" style={{ justifyContent: "space-between" }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Detalhes do envio
        </Typography.Title>
        <Space>
          <Button onClick={() => router.push("/shipments")}>Voltar</Button>
          <Button type="primary" onClick={() => router.push("/etiquetas")}>Nova etiqueta</Button>
        </Space>
      </Space>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !shipment ? (
        <Alert
          type="error"
          message="Envio não encontrado"
          description="Verifique se o código está correto e tente novamente."
          action={
            <Button onClick={() => router.push("/shipments")}>
              Voltar para listagem
            </Button>
          }
        />
      ) : (
        <Card title={`Detalhes do envio — ${shipment.trackingCode}`}>
          <Descriptions column={2} bordered size="middle">
            <Descriptions.Item label="Status">
              {STATUS_LABELS[shipment.status] ?? shipment.status}
            </Descriptions.Item>
            <Descriptions.Item label="Código de rastreio">
              {shipment.trackingCode}
            </Descriptions.Item>
            <Descriptions.Item label="Destinatário">
              {shipment.recipientName}
            </Descriptions.Item>
            <Descriptions.Item label="Cidade destino">
              {shipment.recipientCityUf}
            </Descriptions.Item>
            <Descriptions.Item label="Cidade origem">
              {shipment.carrierName}
            </Descriptions.Item>
            <Descriptions.Item label="Serviço">
              {shipment.serviceName}
            </Descriptions.Item>
            <Descriptions.Item label="Prazo estimado">
              {shipment.etaDays} dias
            </Descriptions.Item>
            <Descriptions.Item label="Valor do frete">
              R$ {shipment.freightValue.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="Criado em" span={2}>
              {new Date(shipment.createdAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Flex>
  );
}
