import 'server-only';

/**
 * Labels List Service
 *
 * Gerencia listagem e operações de etiquetas do usuário.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { ApiError } from '@/platform/api/errors';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { LabelItem, LabelsResponse, PrintStatus, PackageItem, PackageLabelStatus } from '@/shared/types/label';

// =============================================================================
// Types
// =============================================================================

export interface LabelsListFilters {
  q?: string;
  printStatus?: PrintStatus | 'all';
}

export interface LabelsPagination {
  page: number;
  pageSize: number;
}

export interface LabelsServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: LabelsServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista etiquetas do usuário com filtros e paginação.
 */
export async function listUserLabels(
  userId: string,
  filters: LabelsListFilters,
  pagination: LabelsPagination,
  deps: LabelsServiceDeps = defaultDeps
): Promise<LabelsResponse> {
  const { prisma } = deps;
  const { q, printStatus } = filters;
  const { page, pageSize } = pagination;

  const where: Prisma.LabelWhereInput = {
    shipment: {
      senderId: userId,
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

  const items = mapLabelsToItems(labels);

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Marca uma etiqueta como impressa.
 */
export async function markLabelAsPrinted(
  userId: string,
  labelId: string,
  deps: LabelsServiceDeps = defaultDeps
): Promise<{ id: string; isPrinted: boolean; printedAt?: string }> {
  const { prisma } = deps;

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

  if (label.shipment.senderId !== userId) {
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
    id: updated.id,
    isPrinted: updated.isPrinted,
    printedAt: updated.printedAt?.toISOString(),
  };
}

/**
 * Maps database labels to DTOs.
 */
export function mapLabelsToItems(labels: any[]): LabelItem[] {
  return labels.map((label) => {
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

    const packages: PackageItem[] = label.shipment.packages.map((pkg: any) => {
      let labelStatus: PackageLabelStatus = 'pending';
      if (pkg.carrierPrePostageId) {
        labelStatus = 'generated';
      }

      let contentType: PackageItem['contentType'] = 'unknown';
      let contentSummary: string | undefined;
      let contentValue: number | undefined;

      if (doc?.chavesNFe && doc.chavesNFe.length > 0) {
        contentType = 'nfe';
        const chave = doc.chavesNFe[0];
        contentSummary = `${chave.substring(0, 5)}...${chave.substring(chave.length - 4)}`;
        contentValue = doc.valorDeclarado || label.shipment.declaredValue || undefined;
      } else if (doc?.itensDeclaracaoConteudo && doc.itensDeclaracaoConteudo.length > 0) {
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
      price: label.priceCents / 100,
      currency: label.currency as 'BRL',
      trackingCode: label.shipment.platformTrackingCode ?? label.trackingCode ?? undefined,
      isPrinted: label.isPrinted,
      printedAt: label.printedAt?.toISOString() ?? undefined,
      origin: {
        label: originAddress?.nome,
        cep: label.shipment.originCep,
        city: originAddress?.cidade,
        state: originAddress?.uf,
      },
      destinationCep: label.shipment.destinationCep,
      recipient: {
        name: label.recipientName || label.shipment.recipientName || 'Não informado',
        document: label.shipment.recipientDocument ?? undefined,
        city: label.shipment.destinationCity ?? undefined,
        state: label.shipment.destinationState ?? undefined,
      },
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
}
