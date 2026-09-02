"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ELTypography, useELApp } from "@/shared/ui";
const Typography = ELTypography;
const App = { useApp: useELApp };
import { ELCard } from '@/shared/ui/ELCard';
import { CopyOutlined } from "@ant-design/icons";
import { TrackingTimeline, type TrackingEvent } from "@/modules/tracking/ui/components/TrackingTimeline";
import { PublicShipmentItems, type PublicVolume } from "@/modules/tracking/ui/components/PublicShipmentItems";
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELStatusTag, type StatusVariant } from '@/shared/ui/ELStatusTag';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import { ELGrid, ELFlex } from '@/shared/ui/ELGrid';
import { formatBRL, formatPaymentMethod } from "@/shared/utils/format";

const { Text } = Typography;

// Mapeamento de status público para variante visual
const PUBLIC_STATUS_VARIANTS: Record<string, StatusVariant> = {
  DADOS_RECEBIDOS: "default",
  AGUARDANDO_POSTAGEM: "warning",
  POSTADO_ORIGEM: "processing",
  EM_TRANSITO: "processing",
  EM_DESTINO: "processing",
  EM_ROTA_ENTREGA: "warning",
  DISPONIVEL_RETIRADA: "warning",
  TENTATIVA_NAO_REALIZADA: "warning",
  ENTREGUE: "success",
  RETORNANDO_REMETENTE: "warning",
  DEVOLVIDO_REMETENTE: "danger",
  ENVIO_CANCELADO: "danger",
};

type TrackingData = {
  trackingCode: string;
  status: string;
  publicStatus: string;
  publicStatusTitle: string;
  publicStatusDescription: string;
  carrier: string;
  service: string;
  origin: {
    cep: string;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
  senderName: string | null;
  recipientName: string | null;
  senderDocument: string | null;
  recipientDocument: string | null;
  paymentMethod: string | null;
  dceKey: string | null;
  destination: {
    cep: string;
    address: string | null;
    neighborhood: string | null;
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

export default function PublicTrackingClient() {
  const { message } = App.useApp();
  const params = useParams<{ code: string }>();
  const code = params?.code;

  const { data, isLoading, error } = useQuery<TrackingData>({
    queryKey: ["public-track", code],
    queryFn: async () => {
      const res = await fetch(`/api/public/track/${code}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || errorData.message || "Erro ao buscar rastreamento");
      }
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as TrackingData;
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
        <ELSkeleton lines={8} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <ELAlert
          variant="danger"
          title="Envio não encontrado"
          description="Verifique se o código de rastreamento está correto e tente novamente."
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>
      <ELFlex direction="col" gap="md">
        {/* BLOCO 1: Status Atual + Código (compacto) */}
        <ELCard padding="md">
          <ELFlex direction="col" gap="sm">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text strong style={{ fontSize: 14 }}>Status:</Text>
              <ELStatusTag variant={PUBLIC_STATUS_VARIANTS[data.publicStatus] || "default"}>
                {data.publicStatusTitle}
              </ELStatusTag>
            </div>
            {data.publicStatusDescription && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {data.publicStatusDescription}
              </Text>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 13 }}>Código:</Text>
              <Text code style={{ fontSize: 12 }}>{data.trackingCode}</Text>
              <ELButton
                size="small"
                variant="ghost"
                icon={<CopyOutlined />}
                onClick={handleCopyTrackingCode}
                style={{ padding: "0 8px", height: 24 }}
              >
                Copiar
              </ELButton>
            </div>
          </ELFlex>
        </ELCard>

        {/* BLOCO 2: Timeline de Eventos */}
        <TrackingTimeline events={data.events} title="Histórico de rastreamento" />

        {/* BLOCO 3: Detalhes Essenciais */}
        <ELCard header={{ title: "Detalhes do envio" }} padding="lg">
          <ELGrid variant="2" gap="md">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Transportadora</Text>
              <div><Text strong>{data.carrier}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Serviço</Text>
              <div><Text strong>{data.service}</Text></div>
            </div>
            {data.senderName && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Remetente</Text>
                <div><Text strong>{data.senderName}</Text></div>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Origem</Text>
              <div>
                {/* Envios antigos só têm o CEP gravado — daí o fallback. */}
                {data.origin.address ? (
                  <Text>
                    {data.origin.address}
                    {data.origin.neighborhood ? ` - ${data.origin.neighborhood}` : ''}
                    <br />
                    {[data.origin.city, data.origin.state].filter(Boolean).join('/')}
                    {data.origin.city ? ' - ' : ''}
                    {data.origin.cep}
                  </Text>
                ) : (
                  <Text>{data.origin.cep}</Text>
                )}
              </div>
            </div>
            {data.recipientName && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Destinatário</Text>
                <div><Text strong>{data.recipientName}</Text></div>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Destino</Text>
              <div>
                {data.destination.address ? (
                  <Text>
                    {data.destination.address}
                    {data.destination.neighborhood ? ` - ${data.destination.neighborhood}` : ''}
                    <br />
                    {data.destination.city}/{data.destination.state} - {data.destination.cep}
                  </Text>
                ) : (
                  <Text>{data.destination.city}/{data.destination.state} - {data.destination.cep}</Text>
                )}
              </div>
            </div>
            {data.estimatedDays && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Prazo estimado</Text>
                <div><Text>{data.estimatedDays} dias úteis</Text></div>
              </div>
            )}
            {data.weight && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Peso</Text>
                <div><Text>{data.weight} kg</Text></div>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Valor do frete</Text>
              <div><Text>{data.freightCost ? formatBRL(data.freightCost) : 'Não informado'}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Valor declarado</Text>
              <div><Text>{data.declaredValue ? formatBRL(data.declaredValue) : 'Não informado'}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Método de pagamento</Text>
              <div>
                <Text>{formatPaymentMethod(data.paymentMethod)}</Text>
              </div>
            </div>
            {data.dceKey && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Chave da DC-e</Text>
                <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                  {data.dceKey}
                </div>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Criado em</Text>
              <div><Text>{new Date(data.createdAt).toLocaleString("pt-BR")}</Text></div>
            </div>
            {data.postedAt && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Data de postagem</Text>
                <div><Text>{new Date(data.postedAt).toLocaleDateString("pt-BR")}</Text></div>
              </div>
            )}
            {data.deliveredAt && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Data de entrega</Text>
                <div><Text>{new Date(data.deliveredAt).toLocaleDateString("pt-BR")}</Text></div>
              </div>
            )}
          </ELGrid>
        </ELCard>

        {/* BLOCO 4: Itens do Envio */}
        <PublicShipmentItems
          volumes={data.volumes}
          shipmentInfo={{
            trackingCode: data.trackingCode,
            carrier: data.carrier,
            service: data.service,
            senderName: data.senderName,
            senderDocument: data.senderDocument,
            recipientName: data.recipientName,
            recipientDocument: data.recipientDocument,
            origin: data.origin,
            destination: data.destination,
            createdAt: data.createdAt,
          }}
        />
      </ELFlex>
    </div>
  );
}
