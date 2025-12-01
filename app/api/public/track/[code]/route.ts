
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePublicTimeline, mapToPublicTrackingStatus, PublicStatusMessages } from '@/lib/shipments/public-tracking-status';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

/**
 * GET /api/public/track/[code]
 * Public tracking endpoint - no authentication required
 * Returns sanitized shipment data with tracking events
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { code: 'INVALID_CODE', message: 'Código de rastreamento inválido' },
        { status: 400 }
      );
    }

    // Buscar shipment pelo publicTrackingId
    const shipment = await prisma.shipment.findFirst({
      where: { publicTrackingId: code },
      select: {
        id: true,
        platformTrackingCode: true,
        status: true,
        carrier: true,
        service: true,
        originCep: true,
        destinationCep: true,
        destinationCity: true,
        destinationState: true,
        estimatedDays: true,
        freightCost: true,
        declaredValue: true,
        weight: true,
        postedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        document: true,
        // Relacionamento com eventos
        trackingEvents: {
          select: {
            id: true,
            type: true,
            description: true,
            city: true,
            uf: true,
            occurredAt: true,
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
        // Relacionamento com packages/volumes
        packages: {
          select: {
            id: true,
            packageNumber: true,
          },
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

    // Usar eventos reais quando disponíveis, caso contrário gerar timeline fictícia
    let events;

    if (shipment.trackingEvents && shipment.trackingEvents.length > 0) {
      // Usar eventos reais do banco de dados
      events = shipment.trackingEvents.map((event) => ({
        status: event.type,
        title: mapToPublicTrackingStatus(event.type as ShipmentStatus),
        description: event.description,
        location: event.city && event.uf ? `${event.city}, ${event.uf}` : null,
        occurredAt: event.occurredAt.toISOString(),
      }));
    } else {
      // Fallback: gerar timeline pública fictícia
      const publicTimeline = generatePublicTimeline({
        createdAt: shipment.createdAt,
        status: shipment.status,
        originCity: undefined,
        originState: undefined,
        destinationCity: shipment.destinationCity || undefined,
        destinationState: shipment.destinationState || undefined,
      });

      events = publicTimeline.map((event) => ({
        status: event.status,
        title: event.title,
        description: event.description,
        location: event.location || null,
        occurredAt: event.timestamp.toISOString(),
      }));
    }

    // Processar volumes e itens
    type PublicVolume = {
      index: number;
      documentType: 'DECLARATION' | 'NF';
      nfKey?: string;
      items: Array<{
        description: string;
        quantity: number;
        unitValue?: number;
        subtotal?: number;
      }>;
    };

    const volumes: PublicVolume[] = [];

    // Processar document para obter itens
    type DocumentItem = {
      descricao?: string;
      description?: string;
      produto?: string;
      quantidade?: number;
      quantity?: number;
      valorUnitario?: number;
      unitValue?: number;
      valor?: number;
      subtotal?: number;
      total?: number;
    };

    type VolumeDeclaration = {
      volumeIndex?: number;
      items?: DocumentItem[];
    };

    interface ShipmentDocument {
      type?: string;
      nfeKeys?: string[];
      nfKey?: string;
      items?: DocumentItem[];
      volumeDeclarations?: VolumeDeclaration[];
      declarationItems?: DocumentItem[];
    }

    const doc = (shipment.document as unknown) as ShipmentDocument | null;
    const packageVolumes = shipment.packages || [];

    console.log('[PUBLIC_TRACK] Processando volumes:', {
      hasDocument: !!doc,
      documentType: doc?.type,
      hasVolumeDeclarations: !!doc?.volumeDeclarations,
      hasDeclarationItems: !!doc?.declarationItems,
      hasItems: !!doc?.items,
      packagesCount: packageVolumes.length,
    });

    if (doc) {
      const documentType = doc.type || 'DECLARACAO';

      if (documentType === 'NFE') {
        // NF-e
        const docNfeKey = (doc as { nfKey?: string }).nfKey;
        const nfeKeys = doc.nfeKeys || (docNfeKey ? [docNfeKey] : []);
        const nfeItems = doc.items || [];

        if (nfeItems.length > 0) {
          if (packageVolumes.length > 0) {
            // Criar um volume para cada package (todos com os mesmos itens da NF)
            packageVolumes.forEach((pkg) => {
              volumes.push({
                index: pkg.packageNumber,
                documentType: 'NF',
                nfKey: nfeKeys[0], // Usar primeira chave
                items: nfeItems.map((item: DocumentItem) => ({
                  description: item.descricao || item.description || item.produto || 'Item',
                  quantity: item.quantidade || item.quantity || 1,
                  unitValue: item.valorUnitario || item.unitValue || item.valor,
                  subtotal: item.subtotal || item.total,
                })),
              });
            });
          } else {
            // Sem packages, criar volume único
            volumes.push({
              index: 1,
              documentType: 'NF',
              nfKey: nfeKeys[0],
              items: nfeItems.map((item: DocumentItem) => ({
                description: item.descricao || item.description || item.produto || 'Item',
                quantity: item.quantidade || item.quantity || 1,
                unitValue: item.valorUnitario || item.unitValue || item.valor,
                subtotal: item.subtotal || item.total,
              })),
            });
          }
        }
      } else {
        // Declaração de conteúdo
        // Novo formato: volumeDeclarations
        if (doc.volumeDeclarations && Array.isArray(doc.volumeDeclarations)) {
          doc.volumeDeclarations.forEach((volDecl: VolumeDeclaration) => {
            const items = volDecl.items || [];
            volumes.push({
              index: volDecl.volumeIndex || 1,
              documentType: 'DECLARATION',
              items: items.map((item: DocumentItem) => ({
                description: item.descricao || item.description || item.produto || 'Item',
                quantity: item.quantidade || item.quantity || 1,
                unitValue: item.valorUnitario || item.unitValue || item.valor,
                subtotal: item.subtotal || item.total,
              })),
            });
          });
        }
        // Formato legado: declarationItems
        else if (doc.declarationItems && Array.isArray(doc.declarationItems)) {
          volumes.push({
            index: 1,
            documentType: 'DECLARATION',
            items: doc.declarationItems.map((item: DocumentItem) => ({
              description: item.descricao || item.description || item.produto || 'Item',
              quantity: item.quantidade || item.quantity || 1,
              unitValue: item.valorUnitario || item.unitValue || item.valor,
              subtotal: item.subtotal || item.total,
            })),
          });
        }
      }
    }

    console.log('[PUBLIC_TRACK] Volumes processados:', volumes.length);

    // Mapear status interno para status público
    const publicStatus = mapToPublicTrackingStatus(shipment.status as ShipmentStatus);
    const publicStatusInfo = PublicStatusMessages[publicStatus];

    // Sanitizar dados - não retornar informações sensíveis
    const sanitizedData = {
      trackingCode: shipment.platformTrackingCode, // Expor apenas código da plataforma
      status: shipment.status, // Status interno (mantido para compatibilidade)
      publicStatus: publicStatus, // Status público simplificado
      publicStatusTitle: publicStatusInfo.title,
      publicStatusDescription: publicStatusInfo.description,
      carrier: shipment.carrier || 'Não informado',
      service: shipment.service || 'Não informado',
      origin: {
        cep: shipment.originCep,
      },
      destination: {
        cep: shipment.destinationCep,
        city: shipment.destinationCity,
        state: shipment.destinationState,
      },
      estimatedDays: shipment.estimatedDays,
      freightCost: shipment.freightCost,
      declaredValue: shipment.declaredValue,
      weight: shipment.weight,
      postedAt: shipment.postedAt?.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      // Eventos de rastreamento (garantido ao menos 1)
      events,
      // Volumes e itens
      volumes,
    };

    return NextResponse.json(sanitizedData);
  } catch (error) {
    console.error('[PUBLIC_TRACK_GET]', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Erro ao buscar rastreamento' },
      { status: 500 }
    );
  }
}
