import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from "@/platform/db/db";
import type { LabelItem, LabelsResponse, PrintStatus, PackageItem, PackageLabelStatus } from "@/shared/types/label";
import type { Prisma } from "@prisma/client";


/**
 * GET /api/labels
 * Lista etiquetas do usuário com filtros e dados expandidos (packages, origem)
 */
export const GET = withApiHandler<LabelsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
  const q = searchParams.get('q') ?? '';
  const printStatus = (searchParams.get('printStatus') ?? 'all') as PrintStatus | 'all';

  const where: Prisma.LabelWhereInput = {
    shipment: {
      senderId: session.userId,
      status: {
        notIn: ['cancelled', 'failed'],
      },
    },
  };

  if (q && q.trim().length > 0) {
    where.OR = [
      { trackingCode: { contains: q, mode: 'insensitive' } },
      { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
      { shipment: { carrierTrackingCode: { contains: q, mode: 'insensitive' } } },
      { shipmentId: q },
    ];
  }

  if (printStatus === 'printed') {
    where.isPrinted = true;
  } else if (printStatus === 'not_printed') {
    where.isPrinted = false;
  }

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
            document: true,
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
          // Abreviar chave: primeiros 5 + ... + últimos 4
          contentSummary = `${chave.substring(0, 5)}...${chave.substring(chave.length - 4)}`;
          contentValue = doc.valorDeclarado || label.shipment.declaredValue || undefined;
        }
        // Verificar se tem declaração de conteúdo
        else if (doc?.itensDeclaracaoConteudo && doc.itensDeclaracaoConteudo.length > 0) {
          contentType = 'declaration';
          const totalItens = doc.itensDeclaracaoConteudo.reduce((sum, item) => sum + item.quantidade, 0);
          const totalValor = doc.itensDeclaracaoConteudo.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);
          contentSummary = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;
          contentValue = totalValor > 0 ? totalValor : undefined;
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

  return { data: response };
});

interface LabelPrintUpdateResponse {
  message: string;
  label: {
    id: string;
    isPrinted: boolean;
    printedAt?: string;
  };
}

/**
 * PATCH /api/labels?id=xxx
 * Marca etiqueta como impressa
 */
export const PATCH = withApiHandler<LabelPrintUpdateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const labelId = searchParams.get('id');

  if (!labelId) {
    throw new ApiError({ code: 'validation_error', message: 'ID da etiqueta é obrigatório', status: 400 });
  }

  const label = await prisma.label.findUnique({
    where: { id: labelId },
    include: {
      shipment: {
        select: { senderId: true },
      },
    },
  });

  if (!label) {
    throw new ApiError({ code: 'not_found', message: 'Etiqueta não encontrada', status: 404 });
  }

  if (label.shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const updated = await prisma.label.update({
    where: { id: labelId },
    data: {
      isPrinted: true,
      printedAt: new Date(),
    },
  });

  return {
    data: {
      message: 'Etiqueta marcada como impressa',
      label: {
        id: updated.id,
        isPrinted: updated.isPrinted,
        printedAt: updated.printedAt?.toISOString(),
      },
    },
  };
});
