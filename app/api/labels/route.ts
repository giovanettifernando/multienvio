import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";
import type { LabelItem, LabelsResponse, PrintStatus } from "@/lib/types/label";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/labels
 * Lista etiquetas do usuário com filtros
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

    // Filtro de busca por tracking code ou shipment ID
    if (q && q.trim().length > 0) {
      where.OR = [
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { shipment: { trackingCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Filtro de status de impressão
    if (printStatus === 'printed') {
      where.isPrinted = true;
    } else if (printStatus === 'not_printed') {
      where.isPrinted = false;
    }

    // Contar total de registros
    const total = await prisma.label.count({ where });

    // Buscar etiquetas com dados do shipment
    const labels = await prisma.label.findMany({
      where,
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            originCep: true,
            destinationCep: true,
            recipientName: true,
            recipientDocument: true,
            destinationCity: true,
            destinationState: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Mapear para formato do frontend
    const items: LabelItem[] = labels.map((label) => ({
      id: label.id,
      shipmentId: label.shipmentId,
      carrier: label.carrier,
      service: label.service,
      status: label.status as LabelItem['status'],
      price: label.priceCents / 100, // Converter centavos para reais
      currency: label.currency as 'BRL',
      trackingCode: label.trackingCode ?? undefined,
      isPrinted: label.isPrinted,
      printedAt: label.printedAt?.toISOString() ?? undefined,
      originCep: label.shipment.originCep,
      destinationCep: label.shipment.destinationCep,
      recipient: {
        // Priorizar recipientName do label (denormalizado), fallback para shipment
        name: label.recipientName || label.shipment.recipientName || 'Não informado',
        document: label.shipment.recipientDocument ?? undefined,
        city: label.shipment.destinationCity ?? undefined,
        state: label.shipment.destinationState ?? undefined,
      },
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
    }));

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
