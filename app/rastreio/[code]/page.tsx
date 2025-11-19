"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Space,
  Skeleton,
  Alert,
  Tag,
  Row,
  Col,
} from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { TrackingTimeline, type TrackingEvent } from "@/components/track/TrackingTimeline";
import { PublicShipmentItems, type PublicVolume } from "@/components/track/PublicShipmentItems";
import { App } from "antd";

const { Text } = Typography;

const STATUS_LABELS: Record<string, string> = {
  criado: "Criado",
  pending_payment: "Aguardando pagamento",
  awaiting_pickup: "Aguardando coleta",
  awaiting_posting: "Aguardando postagem",
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
  awaiting_pickup: "processing",
  awaiting_posting: "default",
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
  volumes: PublicVolume[];
};

export default function PublicTrackingPage() {
  const { message } = App.useApp();
  const params = useParams<{ code: string }>();
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
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <Alert
          type="error"
          message="Envio não encontrado"
          description="Verifique se o código de rastreamento está correto e tente novamente."
          showIcon
        />
      </div>
    );
  }

  console.log('[PublicTrackingPage] Data recebida:', {
    hasVolumes: !!data.volumes,
    volumesCount: data.volumes?.length,
    volumes: data.volumes
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {/* BLOCO 1: Status Atual + Código (compacto) */}
        <Card
          style={{
            backgroundColor: "#fafafa",
            border: "1px solid #d9d9d9",
          }}
          bodyStyle={{ padding: "12px 16px" }}
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text strong style={{ fontSize: 14 }}>Status:</Text>
              <Tag
                color={STATUS_COLORS[data.status] || "default"}
                style={{ fontSize: 13, margin: 0 }}
              >
                {STATUS_LABELS[data.status] || data.status}
              </Tag>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 13 }}>Código:</Text>
              <Text code style={{ fontSize: 12 }}>{data.trackingCode}</Text>
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                onClick={handleCopyTrackingCode}
                style={{ padding: "0 8px", height: 24 }}
              >
                Copiar
              </Button>
            </div>
          </Space>
        </Card>

        {/* BLOCO 2: Timeline de Eventos */}
        <TrackingTimeline events={data.events} title="Histórico de rastreamento" />

        {/* BLOCO 3: Detalhes Essenciais */}
        <Card title="Detalhes do envio" bodyStyle={{ padding: "16px" }}>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Transportadora</Text>
                <div><Text strong>{data.carrier}</Text></div>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Serviço</Text>
                <div><Text strong>{data.service}</Text></div>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Origem</Text>
                <div><Text>{data.origin.cep}</Text></div>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Destino</Text>
                <div><Text>{data.destination.city}/{data.destination.state} - {data.destination.cep}</Text></div>
              </div>
            </Col>
            {data.estimatedDays && (
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Prazo estimado</Text>
                  <div><Text>{data.estimatedDays} dias úteis</Text></div>
                </div>
              </Col>
            )}
            {data.weight && (
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Peso</Text>
                  <div><Text>{data.weight} kg</Text></div>
                </div>
              </Col>
            )}
            {data.postedAt && (
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Data de postagem</Text>
                  <div><Text>{new Date(data.postedAt).toLocaleDateString("pt-BR")}</Text></div>
                </div>
              </Col>
            )}
            {data.deliveredAt && (
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Data de entrega</Text>
                  <div><Text>{new Date(data.deliveredAt).toLocaleDateString("pt-BR")}</Text></div>
                </div>
              </Col>
            )}
          </Row>
        </Card>

        {/* BLOCO 4: Itens do Envio */}
        <PublicShipmentItems volumes={data.volumes} />
      </Space>
    </div>
  );
}
