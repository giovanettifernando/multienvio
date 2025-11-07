"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Descriptions,
  Typography,
  Button,
  Space,
  Skeleton,
  Alert,
  Tag,
} from "antd";
import { ArrowLeftOutlined, CopyOutlined } from "@ant-design/icons";
import { TrackingTimeline, type TrackingEvent } from "@/components/track/TrackingTimeline";
import { App } from "antd";

const STATUS_LABELS: Record<string, string> = {
  criado: "Criado",
  pending_payment: "Aguardando pagamento",
  ready_for_posting: "Pronto para postagem",
  posted: "Postado",
  in_transit: "Em trânsito",
  out_for_delivery: "Em rota de entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
  payment_failed: "Falha no pagamento",
};

const STATUS_COLORS: Record<string, string> = {
  criado: "default",
  pending_payment: "warning",
  ready_for_posting: "processing",
  posted: "blue",
  in_transit: "blue",
  out_for_delivery: "orange",
  delivered: "success",
  cancelled: "error",
  payment_failed: "error",
};

type TrackingData = {
  trackingCode: string;
  status: string;
  carrier: string;
  service: string;
  origin: {
    cep: string;
  };
  destination: {
    cep: string;
    city: string;
    state: string;
  };
  estimatedDays: number | null;
  freightCost: number | null;
  declaredValue: number | null;
  weight: number | null;
  postedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  events: TrackingEvent[];
};

export default function PublicTrackingPage() {
  const { message } = App.useApp();
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params?.code;

  const { data, isLoading, error } = useQuery<TrackingData>({
    queryKey: ["public-track", code],
    queryFn: async () => {
      const res = await fetch(`/api/public/track/${code}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao buscar rastreamento");
      }
      return res.json();
    },
    enabled: !!code,
  });

  const handleCopyTrackingCode = () => {
    if (data?.trackingCode) {
      navigator.clipboard.writeText(data.trackingCode);
      message.success("Código de rastreamento copiado!");
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <Alert
          type="error"
          message="Envio não encontrado"
          description="Verifique se o código de rastreamento está correto e tente novamente."
          showIcon
          action={
            <Button onClick={() => router.push("/")}>
              Voltar para página inicial
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Header */}
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push("/")}
            style={{ marginBottom: 16 }}
          >
            Voltar
          </Button>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Rastreamento de Envio
          </Typography.Title>
          <Typography.Text type="secondary">
            Acompanhe o status e histórico do seu envio em tempo real
          </Typography.Text>
        </div>

        {/* Status Card */}
        <Card>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Typography.Text strong style={{ fontSize: 16 }}>
                Status atual:
              </Typography.Text>{" "}
              <Tag
                color={STATUS_COLORS[data.status] || "default"}
                style={{ fontSize: 14 }}
              >
                {STATUS_LABELS[data.status] || data.status}
              </Tag>
            </div>
            <div>
              <Space>
                <Typography.Text strong>Código de rastreamento:</Typography.Text>
                <Typography.Text code>{data.trackingCode}</Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopyTrackingCode}
                >
                  Copiar
                </Button>
              </Space>
            </div>
          </Space>
        </Card>

        {/* Shipment Details */}
        <Card title="Detalhes do envio">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Transportadora">
              {data.carrier}
            </Descriptions.Item>
            <Descriptions.Item label="Serviço">
              {data.service}
            </Descriptions.Item>
            <Descriptions.Item label="CEP origem">
              {data.origin.cep}
            </Descriptions.Item>
            <Descriptions.Item label="CEP destino">
              {data.destination.cep}
            </Descriptions.Item>
            <Descriptions.Item label="Cidade/UF destino" span={2}>
              {data.destination.city}/{data.destination.state}
            </Descriptions.Item>
            {data.estimatedDays && (
              <Descriptions.Item label="Prazo estimado">
                {data.estimatedDays} dias
              </Descriptions.Item>
            )}
            {data.weight && (
              <Descriptions.Item label="Peso">
                {data.weight} kg
              </Descriptions.Item>
            )}
            {data.declaredValue && (
              <Descriptions.Item label="Valor declarado">
                R$ {data.declaredValue.toFixed(2)}
              </Descriptions.Item>
            )}
            {data.freightCost && (
              <Descriptions.Item label="Valor do frete">
                R$ {data.freightCost.toFixed(2)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Data de criação">
              {new Date(data.createdAt).toLocaleString("pt-BR")}
            </Descriptions.Item>
            {data.postedAt && (
              <Descriptions.Item label="Data de postagem">
                {new Date(data.postedAt).toLocaleString("pt-BR")}
              </Descriptions.Item>
            )}
            {data.deliveredAt && (
              <Descriptions.Item label="Data de entrega">
                {new Date(data.deliveredAt).toLocaleString("pt-BR")}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Timeline */}
        <TrackingTimeline events={data.events} />
      </Space>
    </div>
  );
}
