import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";
import type { LabelItem, LabelsResponse, PrintStatus, PackageItem, PackageLabelStatus } from "@/lib/types/label";
import type { Prisma } from "@prisma/client";


/**
 * GET /api/labels
 * Lista etiquetas do usuário com filtros e dados expandidos (packages, origem)
 */
export async function GET(request: Request) {
  try {
    // Autenticar usuário
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
    const q = searchParams.get('q') ?? '';
    const printStatus = (searchParams.get('printStatus') ?? 'all') as PrintStatus | 'all';

    // Construir filtros
    const where: Prisma.LabelWhereInput = {
      shipment: {
        senderId: session.userId,
        status: {
          notIn: ['cancelled', 'failed'], // Excluir envios cancelados/falhos
        },
      },
    };

    // Filtro de busca por tracking code, shipment tracking code ou shipment ID
    if (q && q.trim().length > 0) {
      where.OR = [
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
        { shipment: { carrierTrackingCode: { contains: q, mode: 'insensitive' } } },
        { shipmentId: q }, // Buscar por shipment ID exato
      ];
    }

    // Filtro de status de impressão
    if (printStatus === 'printed') {
      where.isPrinted = true;
    } else if (printStatus === 'not_printed') {
      where.isPrinted = false;
    }

    // Executar count e findMany em paralelo (otimização)
    const [total, labels] = await prisma.$transaction([
      prisma.label.count({ where }),
      prisma.label.findMany({
        where,
        include: {
          shipment: {
            select: {
              id: true,
              platformTrackingCode: true,
              carrierTrackingCode: true,
              originCep: true,
              destinationCep: true,
              recipientName: true,
              recipientDocument: true,
              destinationCity: true,
              destinationState: true,
              carrier: true,
              service: true,
              freightCost: true,
              declaredValue: true,
              document: true, // Contém originAddress com apelido
              packages: {
                orderBy: { packageNumber: 'asc' },
                select: {
                  id: true,
                  packageNumber: true,
                  weight: true,
                  width: true,
                  height: true,
                  length: true,
                  carrierTrackingCode: true,
                  carrierPrePostageId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Mapear para formato do frontend
    const items: LabelItem[] = labels.map((label) => {
      // Extrair dados da origem do document (JSON)
      const doc = label.shipment.document as {
        originAddress?: {
          nome?: string;
          cidade?: string;
          uf?: string;
          cep?: string;
        };
        itensDeclaracaoConteudo?: Array<{
          conteudo: string;
          quantidade: number;
          valor: number;
        }>;
        chavesNFe?: string[];
        valorDeclarado?: number;
      } | null;

      const originAddress = doc?.originAddress;

      // Determinar status do package e conteúdo
      const packages: PackageItem[] = label.shipment.packages.map((pkg) => {
        // Determinar status da etiqueta do package
        let labelStatus: PackageLabelStatus = 'pending';
        if (pkg.carrierPrePostageId) {
          labelStatus = 'generated';
        }

        // Determinar tipo de conteúdo e resumo
        let contentType: PackageItem['contentType'] = 'unknown';
        let contentSummary: string | undefined;
        let contentValue: number | undefined;

        // Verificar se tem NF-e
        if (doc?.chavesNFe && doc.chavesNFe.length > 0) {
          contentType = 'nfe';
          const chave = doc.chavesNFe[0];
          contentSummary = `NF-e: ${chave.substring(0, 8)}...${chave.substring(chave.length - 4)}`;
          contentValue = doc.valorDeclarado || label.shipment.declaredValue;
        }
        // Verificar se tem declaração de conteúdo
        else if (doc?.itensDeclaracaoConteudo && doc.itensDeclaracaoConteudo.length > 0) {
          contentType = 'declaration';
          const totalItens = doc.itensDeclaracaoConteudo.reduce((sum, item) => sum + item.quantidade, 0);
          const totalValor = doc.itensDeclaracaoConteudo.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
          contentSummary = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;
          contentValue = totalValor;
        }

        return {
          id: pkg.id,
          packageNumber: pkg.packageNumber,
          weight: pkg.weight,
          width: pkg.width,
          height: pkg.height,
          length: pkg.length,
          carrierTrackingCode: pkg.carrierTrackingCode,
          carrierPrePostageId: pkg.carrierPrePostageId,
          labelStatus,
          contentType,
          contentSummary,
          contentValue,
        };
      });

      return {
        id: label.id,
        shipmentId: label.shipmentId,
        carrier: label.carrier,
        service: label.service,
        status: label.status as LabelItem['status'],
        price: label.priceCents / 100, // Converter centavos para reais
        currency: label.currency as 'BRL',
        // Expor platformTrackingCode aos clientes
        trackingCode: label.shipment.platformTrackingCode ?? label.trackingCode ?? undefined,
        isPrinted: label.isPrinted,
        printedAt: label.printedAt?.toISOString() ?? undefined,

        // Dados da origem
        origin: {
          label: originAddress?.nome,
          cep: label.shipment.originCep,
          city: originAddress?.cidade,
          state: originAddress?.uf,
        },

        // Dados do destino
        destinationCep: label.shipment.destinationCep,
        recipient: {
          name: label.recipientName || label.shipment.recipientName || 'Não informado',
          document: label.shipment.recipientDocument ?? undefined,
          city: label.shipment.destinationCity ?? undefined,
          state: label.shipment.destinationState ?? undefined,
        },

        // Packages
        packages,
        totalVolumes: packages.length,

        createdAt: label.createdAt.toISOString(),
        updatedAt: label.updatedAt.toISOString(),
        file: label.fileUrl || label.fileBase64
          ? {
              url: label.fileUrl ?? undefined,
              base64: label.fileBase64 ?? undefined,
              contentType: label.contentType ?? undefined,
              sizeBytes: label.sizeBytes ?? undefined,
            }
          : undefined,
      };
    });

    const response: LabelsResponse = {
      items,
      page,
      pageSize,
      total,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[LABELS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar etiquetas';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/labels?id=xxx
 * Marca etiqueta como impressa
 */
export async function PATCH(request: Request) {
  try {
    // Autenticar usuário
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get('id');

    if (!labelId) {
      return NextResponse.json({ message: 'ID da etiqueta é obrigatório' }, { status: 400 });
    }

    // Verificar se a etiqueta pertence ao usuário
    const label = await prisma.label.findUnique({
      where: { id: labelId },
      include: {
        shipment: {
          select: { senderId: true },
        },
      },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Marcar como impressa
    const updated = await prisma.label.update({
      where: { id: labelId },
      data: {
        isPrinted: true,
        printedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Etiqueta marcada como impressa',
      label: {
        id: updated.id,
        isPrinted: updated.isPrinted,
        printedAt: updated.printedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('[LABELS_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
