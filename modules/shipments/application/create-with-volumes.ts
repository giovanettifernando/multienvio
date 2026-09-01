/**
 * Serviço centralizado para criação de Shipments com volumes
 * INVARIÁVEL DE DOMÍNIO: Todo Shipment deve ter pelo menos 1 volume
 */

import { PrismaClient, Prisma, Shipment, Package } from '@prisma/client';
import { getInitialShipmentStatus } from './status-migration';

export interface VolumeInput {
  peso: number; // kg
  altura: number; // cm
  largura: number; // cm
  comprimento: number; // cm
}

export interface ShipmentInput {
  // Tracking
  platformTrackingCode: string;
  carrierTrackingCode?: string | null;

  // Remetente
  senderId: string;
  /**
   * Nome do remetente, congelado no envio. Se vier vazio é resolvido a partir
   * do cadastro do usuário na criação — congelar aqui é o que faz o envio
   * continuar mostrando quem enviou mesmo que a conta mude de nome depois.
   */
  senderName?: string | null;
  /** CPF/CNPJ do remetente. Resolvido junto com o nome quando vier vazio. */
  senderDocument?: string | null;

  /** Chave de acesso da DC-e, quando o documento for declaração de conteúdo. */
  dceKey?: string | null;

  // Destinatário
  recipientName: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientDocument?: string | null;

  // Endereços
  originCep: string;
  /** Origem completa, congelada no envio (mesmo formato do destino). */
  originAddress?: string | null;
  originNeighborhood?: string | null;
  originCity?: string | null;
  originState?: string | null;
  destinationCep: string;
  destinationAddress?: string | null;
  destinationNeighborhood?: string | null;
  destinationCity: string;
  destinationState: string;

  // Dados do envio
  declaredValue: number;
  carrier: string;
  service?: string | null;
  estimatedDays: number;
  freightCost: number;

  // Pickup point (opcional)
  pickupPointId?: string | null;

  // Documento e metadados
  document?: Prisma.InputJsonValue;

  // Status inicial
  status?: string;
  paymentMethod?: string | null;

  // Comissões da plataforma (para reconciliação)
  platformShippingCommissionCents?: number | null;
  platformInsuranceCommissionCents?: number | null;
  platformPickupCommissionCents?: number | null;
}

export interface CreateShipmentWithVolumesInput {
  shipment: ShipmentInput;
  volumes: VolumeInput[];
}

/**
 * Valida e cria um Shipment com seus volumes
 * @throws Error se volumes.length === 0
 */
export async function createShipmentWithVolumes(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: CreateShipmentWithVolumesInput
): Promise<{ shipment: Shipment; packages: Package[] }> {
  // VALIDAÇÃO: Garantir que há pelo menos 1 volume
  if (!input.volumes || input.volumes.length === 0) {
    throw new Error('SHIPMENT_REQUIRES_VOLUMES: Um envio deve ter pelo menos 1 volume');
  }

  // Validar cada volume
  input.volumes.forEach((vol, idx) => {
    if (vol.peso <= 0) {
      throw new Error(`INVALID_VOLUME_${idx}: Peso deve ser maior que 0`);
    }
    if (vol.altura <= 0 || vol.largura <= 0 || vol.comprimento <= 0) {
      throw new Error(`INVALID_VOLUME_${idx}: Dimensões devem ser maiores que 0`);
    }
  });

  // Calcular peso total pela soma dos volumes
  const totalWeight = input.volumes.reduce((sum, vol) => sum + vol.peso, 0);

  // Log para auditoria
  console.log('[CREATE_SHIPMENT_WITH_VOLUMES]', {
    tracking: input.shipment.platformTrackingCode,
    volumeCount: input.volumes.length,
    totalWeight,
    declaredWeight: totalWeight, // Agora sempre calculado
  });

  // Determinar status inicial baseado no contexto
  const initialStatus = input.shipment.status || getInitialShipmentStatus({
    hasPickupPoint: !!input.shipment.pickupPointId,
    hasPickupRequest: false, // Será criado depois se necessário
  });

  // O remetente é sempre o dono da conta. Resolver aqui, num lugar só, evita
  // que cada fluxo de checkout tenha de lembrar de buscar o nome — e evita o
  // engano de usar o `label` do endereço ("Casa", "Escritório") como nome.
  let senderName = input.shipment.senderName ?? null;
  let senderDocument = input.shipment.senderDocument ?? null;
  if (!senderName || !senderDocument) {
    const sender = await tx.user.findUnique({
      where: { id: input.shipment.senderId },
      select: { name: true, razaoSocial: true, cpf: true, cnpj: true },
    });
    senderName = senderName || sender?.razaoSocial || sender?.name || null;
    senderDocument = senderDocument || sender?.cnpj || sender?.cpf || null;
  }

  // Criar shipment com peso calculado
  const shipment = await tx.shipment.create({
    data: {
      ...input.shipment,
      senderName,
      senderDocument,
      weight: totalWeight, // SEMPRE usar peso calculado dos volumes
      status: initialStatus,
    },
  });

  // Criar volumes (packages) associados
  const packages = await Promise.all(
    input.volumes.map((vol, idx) =>
      tx.package.create({
        data: {
          shipmentId: shipment.id,
          packageNumber: idx + 1, // Numeração sequencial a partir de 1
          width: vol.largura,
          height: vol.altura,
          length: vol.comprimento,
          weight: vol.peso,
          hasDivergence: false,
        },
      })
    )
  );

  console.log('[CREATE_SHIPMENT_WITH_VOLUMES] Success:', {
    shipmentId: shipment.id,
    packagesCreated: packages.length,
  });

  return { shipment, packages };
}
