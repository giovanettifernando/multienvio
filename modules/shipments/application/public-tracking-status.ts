/**
 * Status públicos para timeline de rastreio
 * Linguagem neutra e simplificada para o destinatário
 * NÃO expõe operações internas, coletores, falhas, etc.
 */

import { ShipmentStatus } from './shipment-status';

/**
 * Status públicos da timeline (visão do destinatário)
 * Máximo de 6-10 passos claros e objetivos
 */
export enum TrackingPublicStatus {
  /** Dados do envio recebidos */
  DADOS_RECEBIDOS = 'DADOS_RECEBIDOS',

  /** Envio em preparação */
  AGUARDANDO_POSTAGEM = 'AGUARDANDO_POSTAGEM',

  /** Objeto recebido para envio */
  POSTADO_ORIGEM = 'POSTADO_ORIGEM',

  /** Em trânsito */
  EM_TRANSITO = 'EM_TRANSITO',

  /** Chegou na região de entrega */
  EM_DESTINO = 'EM_DESTINO',

  /** Em rota de entrega */
  EM_ROTA_ENTREGA = 'EM_ROTA_ENTREGA',

  /** Disponível para retirada */
  DISPONIVEL_RETIRADA = 'DISPONIVEL_RETIRADA',

  /** Tentativa de entrega não realizada */
  TENTATIVA_NAO_REALIZADA = 'TENTATIVA_NAO_REALIZADA',

  /** Entregue */
  ENTREGUE = 'ENTREGUE',

  /** Retornando ao remetente */
  RETORNANDO_REMETENTE = 'RETORNANDO_REMETENTE',

  /** Devolvido ao remetente */
  DEVOLVIDO_REMETENTE = 'DEVOLVIDO_REMETENTE',

  /** Envio cancelado */
  ENVIO_CANCELADO = 'ENVIO_CANCELADO',
}

/**
 * Mensagens públicas para cada status
 * Linguagem sempre neutra e amigável
 */
export const PublicStatusMessages: Record<TrackingPublicStatus, {
  title: string;
  description: string;
}> = {
  [TrackingPublicStatus.DADOS_RECEBIDOS]: {
    title: 'Dados do envio recebidos',
    description: 'Recebemos os dados do seu envio. Ele está sendo preparado para postagem.',
  },
  [TrackingPublicStatus.AGUARDANDO_POSTAGEM]: {
    title: 'Envio em preparação',
    description: 'O envio está em preparação para ser entregue à transportadora.',
  },
  [TrackingPublicStatus.POSTADO_ORIGEM]: {
    title: 'Objeto recebido para envio',
    description: 'Seu envio foi recebido e está sendo processado na origem.',
  },
  [TrackingPublicStatus.EM_TRANSITO]: {
    title: 'Em trânsito',
    description: 'Seu envio está em trânsito entre as unidades logísticas.',
  },
  [TrackingPublicStatus.EM_DESTINO]: {
    title: 'Chegou na região de entrega',
    description: 'Seu envio chegou na região de destino e está sendo processado para entrega.',
  },
  [TrackingPublicStatus.EM_ROTA_ENTREGA]: {
    title: 'Em rota de entrega',
    description: 'Seu envio saiu para entrega no endereço informado.',
  },
  [TrackingPublicStatus.DISPONIVEL_RETIRADA]: {
    title: 'Disponível para retirada',
    description: 'Seu envio está disponível para retirada em uma unidade indicada na região.',
  },
  [TrackingPublicStatus.TENTATIVA_NAO_REALIZADA]: {
    title: 'Tentativa de entrega não realizada',
    description: 'Tentamos entregar, mas não foi possível. Uma nova tentativa será realizada ou serão enviadas instruções ao destinatário.',
  },
  [TrackingPublicStatus.ENTREGUE]: {
    title: 'Entregue',
    description: 'Seu envio foi entregue ao destinatário.',
  },
  [TrackingPublicStatus.RETORNANDO_REMETENTE]: {
    title: 'Retornando ao remetente',
    description: 'O envio está retornando ao remetente.',
  },
  [TrackingPublicStatus.DEVOLVIDO_REMETENTE]: {
    title: 'Devolvido ao remetente',
    description: 'O envio foi devolvido ao remetente.',
  },
  [TrackingPublicStatus.ENVIO_CANCELADO]: {
    title: 'Envio cancelado',
    description: 'Este envio foi cancelado. Em caso de dúvidas, entre em contato com o remetente.',
  },
};

/**
 * Mapeia ShipmentStatus interno para status público da timeline
 * Esconde detalhes operacionais e usa linguagem neutra
 */
export function mapToPublicTrackingStatus(status: ShipmentStatus): TrackingPublicStatus {
  // AGUARDANDO_POSTAGEM – Tudo que é pré-transportadora (sem expor coleta/ponto)
  if ([
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.PICKUP_FAILED, // Não mostra "fracasso", só que está em preparação
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
  ].includes(status)) {
    return TrackingPublicStatus.AGUARDANDO_POSTAGEM;
  }

  // POSTADO_ORIGEM – Primeiro momento no fluxo logístico
  if ([
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.COLLECTED_FROM_POINT,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  ].includes(status)) {
    return TrackingPublicStatus.POSTADO_ORIGEM;
  }

  // EM_TRANSITO – No meio do caminho
  if ([
    ShipmentStatus.IN_TRANSFER,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  ].includes(status)) {
    return TrackingPublicStatus.EM_TRANSITO;
  }

  // EM_DESTINO – Chegou na região de entrega
  if (status === ShipmentStatus.AT_DESTINATION_HUB) {
    return TrackingPublicStatus.EM_DESTINO;
  }

  // EM_ROTA_ENTREGA – Saiu para o endereço final
  if (status === ShipmentStatus.OUT_FOR_DELIVERY) {
    return TrackingPublicStatus.EM_ROTA_ENTREGA;
  }

  // DISPONIVEL_RETIRADA – Retirada em unidade
  if ([
    ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
  ].includes(status)) {
    return TrackingPublicStatus.DISPONIVEL_RETIRADA;
  }

  // TENTATIVA_NAO_REALIZADA – Problemas de entrega (sem culpar ninguém)
  if ([
    ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
    ShipmentStatus.DELIVERY_PROBLEM,
  ].includes(status)) {
    return TrackingPublicStatus.TENTATIVA_NAO_REALIZADA;
  }

  // ENTREGUE
  if (status === ShipmentStatus.DELIVERED) {
    return TrackingPublicStatus.ENTREGUE;
  }

  // RETORNANDO_REMETENTE – Devolução em andamento
  if ([
    ShipmentStatus.RETURNING_TO_SENDER,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
  ].includes(status)) {
    return TrackingPublicStatus.RETORNANDO_REMETENTE;
  }

  // DEVOLVIDO_REMETENTE – Devolução concluída
  if ([
    ShipmentStatus.RETURNED_TO_SENDER,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
  ].includes(status)) {
    return TrackingPublicStatus.DEVOLVIDO_REMETENTE;
  }

  // ENVIO_CANCELADO – Cancelado antes de postar
  if ([
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.EXPIRED_NOT_POSTED,
  ].includes(status)) {
    return TrackingPublicStatus.ENVIO_CANCELADO;
  }

  // Fallback: se não mapeou, assume que está em preparação
  console.warn('[PUBLIC_TRACKING] Status não mapeado:', status);
  return TrackingPublicStatus.AGUARDANDO_POSTAGEM;
}

/**
 * Evento da timeline pública
 */
export interface PublicTrackingEvent {
  status: TrackingPublicStatus;
  title: string;
  description: string;
  timestamp: Date;
  location?: string;
}

/**
 * Gera a timeline pública de um shipment
 * Sempre começa com DADOS_RECEBIDOS + eventos reais
 *
 * @param shipment Dados do shipment
 * @param events Eventos de tracking (opcional, se houver tabela de histórico)
 */
export function generatePublicTimeline(shipment: {
  createdAt: Date;
  status: string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
}): PublicTrackingEvent[] {
  const timeline: PublicTrackingEvent[] = [];

  // 1. SEMPRE: Primeiro evento é "Dados recebidos"
  const dadosRecebidos = PublicStatusMessages[TrackingPublicStatus.DADOS_RECEBIDOS];
  timeline.push({
    status: TrackingPublicStatus.DADOS_RECEBIDOS,
    title: dadosRecebidos.title,
    description: dadosRecebidos.description,
    timestamp: shipment.createdAt,
    location: shipment.originCity && shipment.originState
      ? `${shipment.originCity}/${shipment.originState}`
      : undefined,
  });

  // 2. Status atual do shipment
  const currentStatus = shipment.status as ShipmentStatus;
  const publicStatus = mapToPublicTrackingStatus(currentStatus);

  // Se o status público for diferente de DADOS_RECEBIDOS, adiciona como evento atual
  if (publicStatus !== TrackingPublicStatus.DADOS_RECEBIDOS) {
    const statusInfo = PublicStatusMessages[publicStatus];

    // Determinar localização baseada no status
    let location: string | undefined;
    if ([
      TrackingPublicStatus.POSTADO_ORIGEM,
      TrackingPublicStatus.AGUARDANDO_POSTAGEM,
    ].includes(publicStatus)) {
      location = shipment.originCity && shipment.originState
        ? `${shipment.originCity}/${shipment.originState}`
        : undefined;
    } else if ([
      TrackingPublicStatus.EM_DESTINO,
      TrackingPublicStatus.EM_ROTA_ENTREGA,
      TrackingPublicStatus.DISPONIVEL_RETIRADA,
      TrackingPublicStatus.TENTATIVA_NAO_REALIZADA,
      TrackingPublicStatus.ENTREGUE,
    ].includes(publicStatus)) {
      location = shipment.destinationCity && shipment.destinationState
        ? `${shipment.destinationCity}/${shipment.destinationState}`
        : undefined;
    }

    timeline.push({
      status: publicStatus,
      title: statusInfo.title,
      description: statusInfo.description,
      timestamp: new Date(), // TODO: Usar timestamp real quando houver histórico
      location,
    });
  }

  return timeline;
}

