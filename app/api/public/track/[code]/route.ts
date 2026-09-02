import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { generatePublicTimeline, mapToPublicTrackingStatus, PublicStatusMessages } from '@/modules/shipments/application/public-tracking-status';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { syncCorreiosTracking } from '@/modules/tracking/application/sync-correios-tracking.service';

/**
 * GET /api/public/track/[code]
 * Public tracking endpoint - no authentication required
 * Returns sanitized shipment data with tracking events
 */
export const GET = withApiHandler<unknown, { code: string }>(async ({ params, logger }) => {
  const { code } = params;

  if (!code) {
    throw new ApiError({
      code: 'INVALID_CODE',
      message: 'Código de rastreamento inválido',
      status: 400,
    });
  }

  // Buscar shipment pelo publicTrackingId (primeira query para verificar se existe e se é Correios)
  const shipmentBasic = await prisma.shipment.findFirst({
    where: { publicTrackingId: code },
    select: {
      id: true,
      carrier: true,
      carrierTrackingCode: true,
    },
  });

  if (!shipmentBasic) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Envio não encontrado',
      status: 404,
    });
  }

  // Se for dos Correios, sincronizar antes de retornar
  if (shipmentBasic.carrier === 'Correios' && shipmentBasic.carrierTrackingCode) {
    try {
      logger.debug('public_track_sync_correios', {
        shipmentId: shipmentBasic.id,
        trackingCode: shipmentBasic.carrierTrackingCode,
      });
      await syncCorreiosTracking(shipmentBasic.carrierTrackingCode);
    } catch (error) {
      // Log do erro mas não falha a requisição - retorna dados do banco
      logger.warn('public_track_sync_error', {
        shipmentId: shipmentBasic.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Buscar shipment completo (após sync, se aplicável)
  const shipment = await prisma.shipment.findFirst({
    where: { publicTrackingId: code },
    select: {
      id: true,
      platformTrackingCode: true,
      status: true,
      carrier: true,
      service: true,
      recipientName: true,
      recipientDocument: true,
      senderDocument: true,
      paymentMethod: true,
      dceKey: true,
      originCep: true,
      originAddress: true,
      originNeighborhood: true,
      originCity: true,
      originState: true,
      senderName: true,
      destinationCep: true,
      destinationAddress: true,
      destinationNeighborhood: true,
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
          height: true,
          width: true,
          length: true,
          weight: true,
        },
        orderBy: {
          packageNumber: 'asc',
        },
      },
    },
  });

  // Shipment sempre existe aqui (já verificamos acima antes do sync)
  // Verificação para TypeScript
  if (!shipment) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Envio não encontrado',
      status: 404,
    });
  }

  // Usar eventos reais quando disponíveis, caso contrário gerar timeline fictícia
  let events;

  if (shipment.trackingEvents && shipment.trackingEvents.length > 0) {
    // Usar eventos reais do banco de dados
    // Formato compatível com TrackingTimeline: type, description, city, uf, occurredAt
    events = shipment.trackingEvents.map((event) => ({
      type: event.type,
      description: event.description,
      city: event.city || null,
      uf: event.uf || null,
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

    // Converter formato da timeline fictícia para formato do TrackingTimeline
    events = publicTimeline.map((event) => ({
      type: event.status,
      description: event.description,
      city: null,
      uf: null,
      occurredAt: event.timestamp.toISOString(),
    }));
  }

  // Processar volumes e itens
  type PublicVolume = {
    index: number;
    documentType: 'DECLARATION' | 'NF';
    nfKey?: string;
    // Dimensões do volume
    height?: number;
    width?: number;
    length?: number;
    weight?: number;
    items: Array<{
      description: string;
      quantity: number;
      unitValue?: number;
      subtotal?: number;
    }>;
    // Dados completos da NF-e para espelho (opcional)
    nfeData?: unknown;
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
    valorTotal?: number; // Usado no novo formato de NF-e
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

  logger.debug('public_track_volumes', {
    hasDocument: !!doc,
    documentType: doc?.type,
    packagesCount: packageVolumes.length,
  });

  // Tipo para package no documento NFE (novo formato)
  type DocumentPackage = {
    chave?: string;
    xmlId?: string | null;
    items?: DocumentItem[];
    // Dados completos da NF-e para espelho
    nfeData?: unknown;
  };

  // Tipo para volume no formato de cotação (legado)
  type QuoteVolume = {
    pesoKg?: number;
    alturaCm?: number;
    larguraCm?: number;
    comprimentoCm?: number;
    items?: DocumentItem[];
  };

  // Tipo estendido do documento que inclui formato de cotação
  interface ExtendedDocument extends ShipmentDocument {
    volumes?: QuoteVolume[];
    packages?: DocumentPackage[];
    nfeItems?: DocumentItem[];
  }

  const extDoc = doc as ExtendedDocument | null;

  if (extDoc) {
    const documentType = extDoc.type || 'DECLARACAO';

    // Criar mapa de packages por número para buscar dimensões
    const packageByNumber = new Map(
      packageVolumes.map(pkg => [pkg.packageNumber, pkg])
    );

    // CASO ESPECIAL: Formato de cotação (legado) - doc.volumes contém dimensões
    // Este formato não tem items detalhados, apenas dimensões físicas
    if (!extDoc.type && extDoc.volumes && Array.isArray(extDoc.volumes)) {

      // Extrair dimensões do doc.volumes ou usar packages físicos
      extDoc.volumes.forEach((vol: QuoteVolume, idx: number) => {
        const volumeIndex = idx + 1;
        const pkgData = packageByNumber.get(volumeIndex);

        // Verificar se o volume tem items (formato híbrido)
        const volItems = vol.items || [];

        volumes.push({
          index: volumeIndex,
          documentType: 'DECLARATION',
          // Priorizar dimensões do package físico, fallback para doc.volumes
          height: pkgData?.height ?? vol.alturaCm ?? undefined,
          width: pkgData?.width ?? vol.larguraCm ?? undefined,
          length: pkgData?.length ?? vol.comprimentoCm ?? undefined,
          weight: pkgData?.weight ?? vol.pesoKg ?? undefined,
          items: volItems.map((item: DocumentItem) => ({
            description: item.descricao || item.description || item.produto || 'Item',
            quantity: item.quantidade || item.quantity || 1,
            unitValue: item.valorUnitario || item.unitValue || item.valor,
            subtotal: item.subtotal || item.total,
          })),
        });
      });
    }
    // Formato com type definido (novo formato)
    else if (documentType === 'NFE') {
      // NF-e - Novo formato: packages (NF por pacote com items)
      const docPackages = extDoc.packages;

      if (docPackages && Array.isArray(docPackages) && docPackages.length > 0) {
        // Novo formato: cada package tem sua chave e items
        docPackages.forEach((docPkg: DocumentPackage, pkgIndex: number) => {
          const volumeIndex = pkgIndex + 1;
          const pkgData = packageByNumber.get(volumeIndex);
          const items = docPkg.items || [];

          volumes.push({
            index: volumeIndex,
            documentType: 'NF',
            nfKey: docPkg.chave,
            height: pkgData?.height ?? undefined,
            width: pkgData?.width ?? undefined,
            length: pkgData?.length ?? undefined,
            weight: pkgData?.weight ?? undefined,
            items: items.map((item: DocumentItem) => ({
              description: item.descricao || item.description || item.produto || 'Item',
              quantity: item.quantidade || item.quantity || 1,
              unitValue: item.valorUnitario || item.unitValue || item.valor,
              subtotal: item.subtotal || item.total || item.valorTotal,
            })),
            // Dados completos da NF-e para espelho
            nfeData: docPkg.nfeData || undefined,
          });
        });
      }
      // Formato legado: nfeItems (lista única de itens) + nfeKeys (lista de chaves)
      else {
        const nfeItems = extDoc.nfeItems || [];
        const nfeKeys = extDoc.nfeKeys || [];

        if (nfeItems.length > 0) {
          if (packageVolumes.length > 0) {
            // Criar um volume para cada package (todos com os mesmos itens da NF)
            packageVolumes.forEach((pkg, pkgIndex) => {
              volumes.push({
                index: pkg.packageNumber,
                documentType: 'NF',
                nfKey: nfeKeys[pkgIndex] || nfeKeys[0], // Usar chave correspondente ou primeira
                height: pkg.height ?? undefined,
                width: pkg.width ?? undefined,
                length: pkg.length ?? undefined,
                weight: pkg.weight ?? undefined,
                items: nfeItems.map((item: DocumentItem) => ({
                  description: item.descricao || item.description || item.produto || 'Item',
                  quantity: item.quantidade || item.quantity || 1,
                  unitValue: item.valorUnitario || item.unitValue || item.valor,
                  subtotal: item.subtotal || item.total || item.valorTotal,
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
                subtotal: item.subtotal || item.total || item.valorTotal,
              })),
            });
          }
        }
      }
    } else {
      // Declaração de conteúdo
      // Novo formato: volumeDeclarations
      if (extDoc.volumeDeclarations && Array.isArray(extDoc.volumeDeclarations)) {
        extDoc.volumeDeclarations.forEach((volDecl: VolumeDeclaration, idx: number) => {
          const items = volDecl.items || [];
          // volumeIndex pode ser 0 (zero-indexed), então usar ?? para preservar 0
          // Converter para 1-indexed para exibição (Volume 1, Volume 2, etc.)
          const volumeIndex = (volDecl.volumeIndex ?? idx) + 1;
          const pkg = packageByNumber.get(volumeIndex);
          volumes.push({
            index: volumeIndex,
            documentType: 'DECLARATION',
            height: pkg?.height ?? undefined,
            width: pkg?.width ?? undefined,
            length: pkg?.length ?? undefined,
            weight: pkg?.weight ?? undefined,
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
      else if (extDoc.declarationItems && Array.isArray(extDoc.declarationItems)) {
        const pkg = packageByNumber.get(1);
        volumes.push({
          index: 1,
          documentType: 'DECLARATION',
          height: pkg?.height ?? undefined,
          width: pkg?.width ?? undefined,
          length: pkg?.length ?? undefined,
          weight: pkg?.weight ?? undefined,
          items: extDoc.declarationItems.map((item: DocumentItem) => ({
            description: item.descricao || item.description || item.produto || 'Item',
            quantity: item.quantidade || item.quantity || 1,
            unitValue: item.valorUnitario || item.unitValue || item.valor,
            subtotal: item.subtotal || item.total,
          })),
        });
      }
    }
  }

  // Se não conseguimos processar volumes do document, mas temos packages, criar volumes a partir deles
  if (volumes.length === 0 && packageVolumes.length > 0) {
    packageVolumes.forEach((pkg) => {
      volumes.push({
        index: pkg.packageNumber,
        documentType: 'DECLARATION',
        height: pkg.height ?? undefined,
        width: pkg.width ?? undefined,
        length: pkg.length ?? undefined,
        weight: pkg.weight ?? undefined,
        items: [], // Sem itens detalhados
      });
    });
  }

  // Fallback final: se ainda não temos volumes mas temos peso no shipment, criar volume único
  if (volumes.length === 0 && shipment.weight) {
    volumes.push({
      index: 1,
      documentType: 'DECLARATION',
      weight: shipment.weight,
      items: [],
    });
  }

  // Deduplicar volumes por index (mantém o primeiro de cada index)
  const seenIndexes = new Set<number>();
  const uniqueVolumes = volumes.filter(vol => {
    if (seenIndexes.has(vol.index)) {
      return false;
    }
    seenIndexes.add(vol.index);
    return true;
  });

  // Mapear status interno para status público
  const publicStatus = mapToPublicTrackingStatus(shipment.status as ShipmentStatus);
  const publicStatusInfo = PublicStatusMessages[publicStatus];

  // Sanitizar dados - não retornar informações sensíveis
  return {
    data: {
      trackingCode: shipment.platformTrackingCode, // Expor apenas código da plataforma
      status: shipment.status, // Status interno (mantido para compatibilidade)
      publicStatus: publicStatus, // Status público simplificado
      publicStatusTitle: publicStatusInfo.title,
      publicStatusDescription: publicStatusInfo.description,
      carrier: shipment.carrier || 'Não informado',
      service: shipment.service || 'Não informado',
      // Endereço completo de origem e destino. O destinatário que abre este
      // link precisa saber de quem veio e para onde vai — antes só o CEP era
      // exposto e a tela tinha de adivinhar o resto.
      origin: {
        cep: shipment.originCep,
        address: shipment.originAddress,
        neighborhood: shipment.originNeighborhood,
        city: shipment.originCity,
        state: shipment.originState,
      },
      senderName: shipment.senderName,
      recipientName: shipment.recipientName,
      // CPF/CNPJ das partes: exigidos pela declaracao de conteudo, que pode ser
      // baixada desta pagina. Ver a nota em PublicShipmentItems.
      senderDocument: shipment.senderDocument,
      recipientDocument: shipment.recipientDocument,
      paymentMethod: shipment.paymentMethod,
      dceKey: shipment.dceKey,
      destination: {
        cep: shipment.destinationCep,
        address: shipment.destinationAddress,
        neighborhood: shipment.destinationNeighborhood,
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
      // Volumes e itens (deduplicados)
      volumes: uniqueVolumes,
    },
  };
});
