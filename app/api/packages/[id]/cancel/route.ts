import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { cancelarPrePostagem } from '@/lib/integrations/correios';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/packages/[id]/cancel
 * Cancela a pré-postagem de um package específico nos Correios
 *
 * Requisitos:
 * - Package deve pertencer a um shipment do usuário autenticado
 * - Package deve ter carrierPrePostageId (pré-postagem gerada)
 * - Pré-postagem não pode ter sido postada ainda
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id: packageId } = await params;

    // 1. Buscar package com shipment para verificar permissão
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        shipment: {
          select: {
            id: true,
            senderId: true,
            status: true,
            platformTrackingCode: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    // 2. Verificar permissão
    if (pkg.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // 3. Verificar se tem pré-postagem
    if (!pkg.carrierPrePostageId) {
      return NextResponse.json(
        { message: 'Este volume não possui pré-postagem gerada' },
        { status: 400 }
      );
    }

    // 4. Verificar status do shipment (não pode cancelar se já postado)
    const nonCancelableStatuses = [
      'POSTED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RETURNED',
      'LOST',
    ];

    if (nonCancelableStatuses.includes(pkg.shipment.status)) {
      return NextResponse.json(
        { message: 'Não é possível cancelar etiqueta de envio já postado ou em trânsito' },
        { status: 400 }
      );
    }

    console.log('[PACKAGE_CANCEL] Canceling pre-postagem:', {
      packageId,
      packageNumber: pkg.packageNumber,
      carrierPrePostageId: pkg.carrierPrePostageId,
      carrierTrackingCode: pkg.carrierTrackingCode,
      shipmentId: pkg.shipment.id,
    });

    // 5. Chamar API dos Correios para cancelar
    const result = await cancelarPrePostagem(pkg.carrierPrePostageId);

    if (!result.success) {
      console.error('[PACKAGE_CANCEL] Correios API failed:', {
        packageId,
        error: result.erro,
      });

      return NextResponse.json(
        { message: result.erro || 'Erro ao cancelar pré-postagem nos Correios' },
        { status: 500 }
      );
    }

    // 6. Atualizar package no banco (limpar dados de pré-postagem)
    await prisma.package.update({
      where: { id: packageId },
      data: {
        carrierTrackingCode: null,
        carrierPrePostageId: null,
        carrierQuotePrice: null,
      },
    });

    // 7. Se todos os packages do shipment foram cancelados, atualizar label status
    const remainingPackages = await prisma.package.count({
      where: {
        shipmentId: pkg.shipment.id,
        carrierPrePostageId: { not: null },
      },
    });

    if (remainingPackages === 0) {
      // Todos os volumes foram cancelados, atualizar label
      await prisma.label.updateMany({
        where: { shipmentId: pkg.shipment.id },
        data: { status: 'canceled' },
      });

      // Também limpar carrierTrackingCode do shipment
      await prisma.shipment.update({
        where: { id: pkg.shipment.id },
        data: {
          carrierTrackingCode: null,
          carrierMetadata: Prisma.DbNull,
        },
      });
    }

    console.log('[PACKAGE_CANCEL] Pre-postagem canceled successfully:', {
      packageId,
      packageNumber: pkg.packageNumber,
      remainingPackagesWithPrePostage: remainingPackages,
    });

    return NextResponse.json({
      message: 'Pré-postagem cancelada com sucesso',
      package: {
        id: packageId,
        packageNumber: pkg.packageNumber,
        canceled: true,
      },
    });
  } catch (error) {
    console.error('[PACKAGE_CANCEL]', error);
    const message = error instanceof Error ? error.message : 'Erro ao cancelar pré-postagem';
    return NextResponse.json({ message }, { status: 500 });
  }
}
