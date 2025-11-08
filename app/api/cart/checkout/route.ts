export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { checkoutCartSchema } from '@/lib/validation/cart';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/cart/checkout
 * Cria shipments a partir dos itens do carrinho
 * Idempotente por cartId + hash dos itens
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar dados
    const validation = checkoutCartSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Transação para garantir atomicidade
    const result = await prisma.$transaction(async (tx) => {
      // Buscar carrinho OPEN com lock para evitar concorrência
      const cart = await tx.cart.findFirst({
        where: {
          userId: session.userId,
          status: 'OPEN',
        },
        include: {
          items: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!cart) {
        throw new Error('CART_NOT_FOUND');
      }

      if (cart.items.length === 0) {
        throw new Error('CART_EMPTY');
      }

      // Filtrar itens se itemIds fornecido
      const itemsToCheckout = data.itemIds?.length
        ? cart.items.filter((item) => data.itemIds?.includes(item.id))
        : cart.items;

      if (itemsToCheckout.length === 0) {
        throw new Error('NO_ITEMS_SELECTED');
      }

      // Gerar fingerprint para idempotência
      const itemsHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(itemsToCheckout.map((i) => i.id)))
        .digest('hex')
        .substring(0, 16);

      const checkoutFingerprint = `${cart.id}-${itemsHash}`;

      // Verificar se já existe checkout com esse fingerprint
      const existingCheckout = cart.meta as { lastCheckoutFingerprint?: string; shipmentIds?: string[]; totalAmount?: number } | null;
      if (
        existingCheckout?.lastCheckoutFingerprint === checkoutFingerprint &&
        existingCheckout?.shipmentIds &&
        existingCheckout.shipmentIds.length > 0
      ) {
        // Idempotência: retornar shipments já criados
        return {
          idempotent: true,
          cartId: cart.id,
          shipmentIds: existingCheckout.shipmentIds,
          totalAmount: existingCheckout.totalAmount,
        };
      }

      // Travar carrinho
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'LOCKED' },
      });

      // Criar shipments a partir dos itens
      const shipmentIds: string[] = [];
      let totalAmount = 0;

      for (const item of itemsToCheckout) {
        const originAddress = item.originAddress as { cep: string; [key: string]: unknown };
        const destination = item.destination as { nome?: string; apelido?: string; telefone?: string; email?: string; documento?: string; cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string; [key: string]: unknown };
        const volumes = item.volumes as Array<{ pesoKg?: number; [key: string]: unknown }>;
        const preferences = item.preferences as Prisma.JsonValue;
        const selectedQuote = item.selectedQuote as { carrier: string; serviceName?: string; serviceCode?: string; deadlineDays: number; price: number; [key: string]: unknown };
        const totals = item.totals as Prisma.JsonValue;

        // Calcular peso total
        const totalWeight = volumes.reduce((sum, vol) => sum + (vol.pesoKg || 0), 0);

        // Valor declarado
        const declaredValue = item.insuranceValue ? Number(item.insuranceValue) : 0;

        // Gerar tracking code único
        const trackingCode = `BR${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // Criar shipment
        const shipment = await tx.shipment.create({
          data: {
            trackingCode,
            senderId: session.userId,
            // Destinatário
            recipientName: destination.nome || destination.apelido || 'Destinatário',
            recipientPhone: destination.telefone,
            recipientEmail: destination.email,
            recipientDocument: destination.documento,
            // Endereço destino
            originCep: originAddress.cep,
            destinationCep: destination.cep,
            destinationAddress: [destination.logradouro, destination.numero, destination.complemento]
              .filter(Boolean)
              .join(', '),
            destinationNeighborhood: destination.bairro,
            destinationCity: destination.cidade,
            destinationState: destination.uf,
            // Dados do envio
            weight: totalWeight,
            declaredValue,
            carrier: selectedQuote.carrier,
            service: selectedQuote.serviceName || selectedQuote.serviceCode,
            estimatedDays: selectedQuote.deadlineDays,
            freightCost: selectedQuote.price,
            // Pickup point
            pickupPointId: item.pickupPoint ? (item.pickupPoint as { id?: string | null; [key: string]: unknown }).id : null,
            // Documento e snapshots
            document: {
              originAddress: item.originAddress,
              destination: item.destination,
              volumes: item.volumes,
              preferences: item.preferences,
              selectedQuote: item.selectedQuote,
              totals: item.totals,
            } as Prisma.InputJsonValue,
            // Status inicial
            status: 'pending_payment',
            paymentMethod: null,
          },
        });

        shipmentIds.push(shipment.id);
        totalAmount += selectedQuote.price || 0;
      }

      // Atualizar meta do carrinho com fingerprint e shipmentIds
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          meta: {
            lastCheckoutFingerprint: checkoutFingerprint,
            lastCheckoutAt: new Date().toISOString(),
            shipmentIds,
            totalAmount,
          },
        },
      });

      return {
        idempotent: false,
        cartId: cart.id,
        shipmentIds,
        totalAmount,
      };
    });

    return NextResponse.json({
      message: result.idempotent
        ? 'Checkout já processado anteriormente'
        : 'Shipments criados com sucesso',
      idempotent: result.idempotent,
      cartId: result.cartId,
      shipmentIds: result.shipmentIds,
      totalAmount: result.totalAmount,
    });
  } catch (error) {
    console.error('[CART_CHECKOUT]', error);

    if (error instanceof Error) {
      if (error.message === 'CART_NOT_FOUND') {
        return NextResponse.json({ message: 'Carrinho não encontrado' }, { status: 404 });
      }

      if (error.message === 'CART_EMPTY') {
        return NextResponse.json({ message: 'Carrinho vazio' }, { status: 400 });
      }

      if (error.message === 'NO_ITEMS_SELECTED') {
        return NextResponse.json(
          { message: 'Nenhum item selecionado para checkout' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { message: 'Erro ao processar checkout' },
      { status: 500 }
    );
  }
}
