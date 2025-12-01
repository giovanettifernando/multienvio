
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/shipments/[id]
 * Retorna detalhes completos de um shipment
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const params = await props.params;
    const { id: shipmentId } = params;

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
        pickupRequest: {
          include: {
            collector: {
              select: {
                id: true,
                pfNome: true,
                pfCelular: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Shipment não encontrado' }, { status: 404 });
    }

    // Verificar se o shipment pertence ao usuário
    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Parse document JSON para extrair dados estruturados
    const document = shipment.document as Record<string, unknown>;
    const documentType = document?.type || 'DECLARACAO';

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
    const { packages, trackingEvents, label, pickupRequest, ...shipmentBase } = shipment;

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

          // Divergence info (stored as flat fields on Package)
          hasDivergence: pkg.hasDivergence,
          divergenceType: pkg.divergenceType || null,
          divergenceWidth: pkg.divergenceWidth || null,
          divergenceHeight: pkg.divergenceHeight || null,
          divergenceLength: pkg.divergenceLength || null,
          divergenceWeight: pkg.divergenceWeight || null,
          divergenceNotes: pkg.divergenceNotes || null,
          divergencePhotoUrl: pkg.divergencePhotoUrl || null,
          divergenceRegisteredAt: pkg.divergenceRegisteredAt?.toISOString() || null,
          divergenceRegisteredBy: pkg.divergenceRegisteredBy || null,
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
      pickupRequest: pickupRequest
        ? {
            ...pickupRequest,
            scheduleAt: pickupRequest.scheduleAt?.toISOString() || null,
            collectedAt: pickupRequest.collectedAt?.toISOString() || null,
            createdAt: pickupRequest.createdAt.toISOString(),
            updatedAt: pickupRequest.updatedAt.toISOString(),
          }
        : null,
    };

    return NextResponse.json(shipmentData);
  } catch (error) {
    console.error('[SHIPMENT_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar shipment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shipments/[id]
 * Deleta um shipment (apenas se ainda não foi pago/processado)
 */
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const params = await props.params;
    const { id: shipmentId } = params;

    // Buscar shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Shipment não encontrado' }, { status: 404 });
    }

    // Verificar se o shipment pertence ao usuário
    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
    }

    // Verificar se o shipment pode ser deletado
    // Permitir deletar apenas se não tem método de pagamento definido
    if (shipment.paymentMethod) {
      return NextResponse.json(
        { message: 'Não é possível deletar um shipment que já foi pago' },
        { status: 400 }
      );
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

    return NextResponse.json({
      message: 'Shipment deletado com sucesso',
      shipmentId,
    });
  } catch (error) {
    console.error('[SHIPMENT_DELETE]', error);
    return NextResponse.json(
      { message: 'Erro ao deletar shipment' },
      { status: 500 }
    );
  }
}
