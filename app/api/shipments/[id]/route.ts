import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

interface ShipmentVolume {
  id: string;
  shipmentId: string;
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  carrierTrackingCode: string | null;
  carrierPrePostageId: string | null;
  carrierQuotePrice: number | null;
  createdAt: string;
  updatedAt: string;
  items?: unknown[];
}

interface ShipmentTrackingEvent {
  id: string;
  shipmentId: string;
  type: string;
  description: string;
  city: string | null;
  uf: string | null;
  occurredAt: string;
  createdAt: string;
}

interface ShipmentLabel {
  id: string;
  shipmentId: string;
  carrier: string;
  service: string;
  status: string;
  priceCents: number;
  currency: string;
  trackingCode: string | null;
  recipientName: string | null;
  fileUrl: string | null;
  fileBase64: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  isPrinted: boolean;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentDetail {
  id: string;
  platformTrackingCode: string;
  carrierTrackingCode: string | null;
  carrierMetadata: unknown;
  senderId: string;
  recipientId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientDocument: string | null;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  destinationCity: string;
  destinationState: string;
  weight: number;
  declaredValue: number | null;
  status: string;
  carrier: string | null;
  service: string | null;
  originCep: string;
  originAddress: string | null;
  originNeighborhood: string | null;
  originCity: string | null;
  originState: string | null;
  senderName: string | null;
  senderDocument: string | null;
  dceKey: string | null;
  destinationCep: string;
  estimatedDays: number | null;
  freightCost: number | null;
  document: unknown;
  paymentMethod: string | null;
  publicTrackingId: string | null;
  postedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  platformShippingCommissionCents: number | null;
  documentType: string;
  nfeKeys: string[];
  items: unknown[];
  volumes: ShipmentVolume[];
  trackingEvents: ShipmentTrackingEvent[];
  label: ShipmentLabel | null;
}

interface ShipmentDeleteResponse {
  message: string;
  shipmentId: string;
}

/**
 * GET /api/shipments/[id]
 * Retorna detalhes completos de um shipment
 */
export const GET = withApiHandler<ShipmentDetail, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const shipmentId = context.params.id;

  // Buscar shipment com todas as relações necessárias
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      packages: {
        orderBy: {
          packageNumber: 'asc',
        },
      },
      trackingEvents: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
      label: true,
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Shipment não encontrado', status: 404 });
  }

  // Verificar se o shipment pertence ao usuário
  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // Parse document JSON para extrair dados estruturados
  const document = shipment.document as Record<string, unknown> | null;
  const documentType: string = (document?.type as string) || 'DECLARACAO';

  // Extrair nfeKeys (do novo formato packages ou do formato legado nfeKeys)
  let nfeKeys: string[] = [];
  if (documentType === 'NFE') {
    if (document?.packages && Array.isArray(document.packages)) {
      // Novo formato: NF por pacote
      nfeKeys = document.packages
        .map((pkg: Record<string, unknown>) => pkg.chave as string)
        .filter((chave: string) => chave && chave.trim().length > 0);
    } else if (document?.nfeKeys && Array.isArray(document.nfeKeys)) {
      // Formato legado: apenas chaves
      nfeKeys = document.nfeKeys.filter((chave: string) => chave && chave.trim().length > 0);
    }
  }

  // Extrair items gerais (para exibir no card de declaração/NF)
  let items: unknown[] = [];
  if (documentType === 'DECLARACAO') {
    if (document?.declarationItems && Array.isArray(document.declarationItems)) {
      items = document.declarationItems;
    }
  } else if (documentType === 'NFE') {
    if (document?.nfeItems && Array.isArray(document.nfeItems)) {
      items = document.nfeItems;
    }
  }

  // Desestruturar para remover campos que serão transformados
  const { packages, trackingEvents, label, ...shipmentBase } = shipment;

  // Serializar para JSON (converter Decimal, Date, etc.)
  const shipmentData = {
    ...shipmentBase,
    declaredValue: shipment.declaredValue ? Number(shipment.declaredValue) : null,
    freightCost: shipment.freightCost ? Number(shipment.freightCost) : null,
    estimatedDays: shipment.estimatedDays || null,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
    postedAt: shipment.postedAt?.toISOString() || null,
    deliveredAt: shipment.deliveredAt?.toISOString() || null,

    // Adicionar campos desserializados do document
    documentType,
    nfeKeys,
    items,

    // Renomear packages para volumes (terminologia da UI)
    volumes: packages.map((pkg, idx) => {
      // Buscar items específicos deste volume (se houver)
      let volumeItems: unknown[] = [];

      if (documentType === 'DECLARACAO' && document?.volumeDeclarations && Array.isArray(document.volumeDeclarations)) {
        // Novo formato: declaração por volume
        const volDecl = document.volumeDeclarations.find((vd: Record<string, unknown>) => vd.volumeIndex === idx);
        if (volDecl && volDecl.items) {
          volumeItems = volDecl.items;
        }
      } else if (documentType === 'NFE' && document?.packages && Array.isArray(document.packages)) {
        // Novo formato: NF por pacote
        const nfPkg = document.packages[idx];
        if (nfPkg && nfPkg.items) {
          volumeItems = nfPkg.items;
        }
      }

      return {
        ...pkg,
        weight: Number(pkg.weight),
        height: Number(pkg.height),
        width: Number(pkg.width),
        length: Number(pkg.length),
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),

        // Items específicos deste volume
        items: volumeItems.length > 0 ? volumeItems : undefined,

      };
    }),
    trackingEvents: trackingEvents.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    })),
    label: label
      ? {
          ...label,
          priceCents: label.priceCents || 0,
          createdAt: label.createdAt.toISOString(),
          updatedAt: label.updatedAt.toISOString(),
          printedAt: label.printedAt?.toISOString() || null,
        }
      : null,
  };

  return { data: shipmentData };
});

/**
 * DELETE /api/shipments/[id]
 * Deleta um shipment (apenas se ainda não foi pago/processado)
 */
export const DELETE = withApiHandler<ShipmentDeleteResponse, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const shipmentId = context.params.id;

  // Buscar shipment
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Shipment não encontrado', status: 404 });
  }

  // Verificar se o shipment pertence ao usuário
  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Não autorizado', status: 403 });
  }

  // Verificar se o shipment pode ser deletado
  // Permitir deletar apenas se não tem método de pagamento definido
  if (shipment.paymentMethod) {
    throw new ApiError({
      code: 'cannot_delete',
      message: 'Não é possível deletar um shipment que já foi pago',
      status: 400,
    });
  }

  // Deletar em transação (cascata: volumes, labels, tracking events)
  await prisma.$transaction([
    // Deletar volumes
    prisma.package.deleteMany({
      where: { shipmentId },
    }),
    // Deletar etiquetas
    prisma.label.deleteMany({
      where: { shipmentId },
    }),
    // Deletar eventos de rastreamento
    prisma.trackingEvent.deleteMany({
      where: { shipmentId },
    }),
    // Deletar shipment
    prisma.shipment.delete({
      where: { id: shipmentId },
    }),
  ]);

  return {
    data: {
      message: 'Shipment deletado com sucesso',
      shipmentId,
    },
  };
});
