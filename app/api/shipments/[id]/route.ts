export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/shipments/:id
 * Retorna detalhes completos do shipment por ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: shipmentId } = await params;

    console.debug('[DETAIL] params.id=', shipmentId);

    // Buscar shipment por ID (escopo do usuário)
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        senderId: session.userId, // Verificar que pertence ao usuário
      },
      include: {
        trackingEvents: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
        packages: {
          orderBy: {
            packageNumber: 'asc',
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Envio não encontrado' },
        { status: 404 }
      );
    }

    // Extrair informações do documento
    const document = shipment.document as any;
    const documentType = document?.type || 'DECLARACAO';

    // Extrair itens da declaração ou NF
    let items: any[] = [];
    let nfeKeys: string[] = [];

    if (documentType === 'NFE') {
      // NF-e: extrair chaves e itens se disponíveis
      nfeKeys = document?.nfeKeys || [];
      // Itens podem não estar disponíveis para NF-e
      items = document?.items || [];
    } else {
      // Declaração: extrair itens
      // Novo formato: declaração por volume
      if (document?.volumeDeclarations && Array.isArray(document.volumeDeclarations)) {
        // Concatenar todos os itens de todos os volumes
        items = document.volumeDeclarations.flatMap((volDecl: any) =>
          (volDecl.items || []).map((item: any) => ({
            ...item,
            volumeIndex: volDecl.volumeIndex,
          }))
        );
      }
      // Formato legado: declaração única
      else if (document?.declarationItems && Array.isArray(document.declarationItems)) {
        items = document.declarationItems;
      }
    }

    // Organizar itens por volume para expansão
    // Mapeamento: volumeIndex -> itens
    const itemsByVolume = new Map<number, any[]>();

    if (documentType === 'DECLARACAO' && document?.volumeDeclarations) {
      // Novo formato: usar volumeDeclarations diretamente
      document.volumeDeclarations.forEach((volDecl: any) => {
        itemsByVolume.set(volDecl.volumeIndex, volDecl.items || []);
      });
    } else if (documentType === 'DECLARACAO' && document?.declarationItems) {
      // Formato legado: todos os itens no primeiro volume
      itemsByVolume.set(0, document.declarationItems);
    } else if (documentType === 'NFE') {
      // NF-e: itens não são organizados por volume (exibir chaves apenas)
      // Não fazer nada - itens serão exibidos globalmente
    }

    // Retornar snapshot completo do shipment
    return NextResponse.json({
      id: shipment.id,
      trackingCode: shipment.platformTrackingCode, // Expor apenas código da plataforma
      publicTrackingId: shipment.publicTrackingId,
      status: shipment.status,
      paymentMethod: shipment.paymentMethod,
      carrier: shipment.carrier,
      service: shipment.service,
      freightCost: shipment.freightCost,
      estimatedDays: shipment.estimatedDays,
      declaredValue: shipment.declaredValue,
      weight: shipment.weight,
      originCep: shipment.originCep,
      destinationCep: shipment.destinationCep,
      destinationCity: shipment.destinationCity,
      destinationState: shipment.destinationState,
      destinationAddress: shipment.destinationAddress,
      destinationNeighborhood: shipment.destinationNeighborhood,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      recipientEmail: shipment.recipientEmail,
      recipientDocument: shipment.recipientDocument,
      pickupPointId: shipment.pickupPointId,
      document: shipment.document, // Snapshot completo (originAddress, destination, volumes, preferences, etc)
      postedAt: shipment.postedAt,
      deliveredAt: shipment.deliveredAt,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      // Volumes (packages)
      volumes: shipment.packages.map((pkg, idx) => {
        // Buscar itens deste volume (packageNumber - 1 = volumeIndex)
        const volumeIndex = pkg.packageNumber - 1;
        const volumeItems = itemsByVolume.get(volumeIndex) || [];

        return {
          id: pkg.id,
          packageNumber: pkg.packageNumber,
          weight: pkg.weight,
          width: pkg.width,
          height: pkg.height,
          length: pkg.length,
          hasDivergence: pkg.hasDivergence,
          divergenceNotes: pkg.divergenceNotes,
          // Itens deste volume (declaração)
          items: volumeItems.map((item: any) => ({
            id: item.id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            subtotal: (item.quantidade || 0) * (item.valorUnitario || 0),
          })),
        };
      }),
      // Itens (declaração ou NF-e)
      documentType,
      nfeKeys,
      items: items.map((item: any) => ({
        id: item.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        subtotal: (item.quantidade || 0) * (item.valorUnitario || 0),
        volumeIndex: item.volumeIndex,
      })),
      // Eventos de rastreamento
      trackingEvents: shipment.trackingEvents.map((event) => ({
        type: event.type,
        description: event.description,
        city: event.city,
        uf: event.uf,
        occurredAt: event.occurredAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('[SHIPMENT_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar envio' },
      { status: 500 }
    );
  }
}
