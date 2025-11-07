"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Flex,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { ShareAltOutlined, CopyOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { TrackingTimeline, type TrackingEvent } from "@/components/track/TrackingTimeline";

const STATUS_LABELS: Record<string, string> = {
  "pending_payment": "Aguardando pagamento",
  "ready_for_posting": "Pronto para postagem",
  "posted": "Postado",
  "in_transit": "Em trânsito",
  "out_for_delivery": "Em rota de entrega",
  "delivered": "Entregue",
  "cancelled": "Cancelado",
  "payment_failed": "Falha no pagamento",
};

export default function ShipmentDetailPage() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  console.debug('[DETAIL] params.id=', id);

  // Buscar shipment diretamente por ID
  const { data: shipment, isLoading, error } = useQuery({
    queryKey: ['shipment', id],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao buscar envio');
      }
      return res.json();
    },
    enabled: !!id,
  });

  const handleOpenPublicLink = () => {
    if (shipment?.publicTrackingId) {
      const url = `${window.location.origin}/rastreio/${shipment.publicTrackingId}`;
      window.open(url, '_blank');
    }
  };

  const handleCopyPublicLink = () => {
    if (shipment?.publicTrackingId) {
      const url = `${window.location.origin}/rastreio/${shipment.publicTrackingId}`;
      navigator.clipboard.writeText(url);
      message.success('Link público copiado!');
    }
  };

  return (
    <Flex vertical gap={24}>
      <Space align="center" style={{ justifyContent: "space-between" }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Detalhes do envio
        </Typography.Title>
        <Space>
          <Button onClick={() => router.push("/shipments")}>Voltar</Button>
          {shipment?.publicTrackingId && (
            <>
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyPublicLink}
              >
                Copiar link público
              </Button>
              <Button
                type="primary"
                icon={<ShareAltOutlined />}
                onClick={handleOpenPublicLink}
              >
                Abrir link público
              </Button>
            </>
          )}
        </Space>
      </Space>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : error || !shipment ? (
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
        <>
          <Card title={`Detalhes do envio — ${shipment.trackingCode}`}>
            <Descriptions column={2} bordered size="middle">
              <Descriptions.Item label="Status">
                {STATUS_LABELS[shipment.status] ?? shipment.status}
              </Descriptions.Item>
              <Descriptions.Item label="Código de rastreio">
                {shipment.trackingCode}
              </Descriptions.Item>
              <Descriptions.Item label="Método de pagamento">
                {shipment.paymentMethod ? (
                  shipment.paymentMethod === 'wallet' ? 'Carteira' :
                  shipment.paymentMethod === 'pix' ? 'PIX' :
                  shipment.paymentMethod === 'card' ? 'Cartão' :
                  shipment.paymentMethod
                ) : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Destinatário">
                {shipment.recipientName || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Cidade destino">
                {shipment.destinationCity}, {shipment.destinationState}
              </Descriptions.Item>
              <Descriptions.Item label="CEP destino">
                {shipment.destinationCep}
              </Descriptions.Item>
              <Descriptions.Item label="Transportadora">
                {shipment.carrier || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Serviço">
                {shipment.service || 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Prazo estimado">
                {shipment.estimatedDays ? `${shipment.estimatedDays} dias` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Valor do frete">
                {shipment.freightCost ? `R$ ${shipment.freightCost.toFixed(2)}` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Valor declarado">
                {shipment.declaredValue ? `R$ ${shipment.declaredValue.toFixed(2)}` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Peso">
                {shipment.weight ? `${shipment.weight} kg` : 'Não informado'}
              </Descriptions.Item>
              <Descriptions.Item label="Criado em" span={2}>
                {new Date(shipment.createdAt).toLocaleString('pt-BR')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Timeline de eventos */}
          {shipment?.trackingEvents && shipment.trackingEvents.length > 0 && (
            <TrackingTimeline
              events={shipment.trackingEvents}
              title="Histórico de rastreamento"
            />
          )}
        </>
      )}
    </Flex>
  );
}
