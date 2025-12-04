
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { checkoutCartSchema } from '@/lib/validation/cart';
import { createShipmentWithVolumes } from '@/lib/shipments/create-with-volumes';
import { createInitialTrackingEvent } from '@/lib/tracking/create-event';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { calculateCommissionsInCents } from '@/lib/quotes/commission';
import { integrateWithCarrier } from '@/lib/shipments/carrier-integration';
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

      // 🛡️ VALIDAÇÃO CRÍTICA: Verificar saldo da carteira ANTES de criar shipments
      // (apenas se método de pagamento for carteira)
      if (data.paymentMethod === 'wallet') {
        // Calcular total do carrinho
        let totalAmountPreview = 0;
        for (const item of itemsToCheckout) {
          const itemTotals = item.totals as { total?: number };
          const itemTotal = itemTotals?.total;

          if (!itemTotal || itemTotal <= 0) {
            throw new Error(`INVALID_ITEM_TOTAL: Item ${item.id} has invalid total: ${itemTotal}`);
          }

          totalAmountPreview += itemTotal;
        }

        // 🔒 CRITICAL FIX: Usar FOR UPDATE para evitar race condition
        // Isso garante que apenas uma transação pode verificar/debitar por vez
        const wallets = await tx.$queryRaw<Array<{ id: string; availableCents: number }>>`
          SELECT id, "availableCents"
          FROM "wallets"
          WHERE "userId" = ${session.userId}
          FOR UPDATE
        `;

        const wallet = wallets[0];
        const availableCents = wallet?.availableCents ?? 0;

        if (availableCents < totalAmountPreview * 100) {
          throw new Error('INSUFFICIENT_WALLET_BALANCE');
        }
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
        // ✅ FIX: Mesmo em caso de idempotência, garantir que itens sejam removidos
        // (pode ter falhado a remoção anterior)
        const processedItemIds = itemsToCheckout.map((item) => item.id);
        await tx.cartItem.deleteMany({
          where: {
            id: { in: processedItemIds },
            cartId: cart.id,
          },
        });

        // Recalcular totais
        const remainingItems = await tx.cartItem.findMany({
          where: { cartId: cart.id },
        });

        const newTotal = remainingItems.reduce((sum, item) => {
          const itemTotals = item.totals as { total?: number };
          return sum + (itemTotals?.total || 0);
        }, 0);

        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: 'OPEN',
            totals: { total: newTotal, moeda: 'BRL' },
          },
        });

        console.log('[CART_CHECKOUT] Idempotência detectada, itens removidos:', {
          cartId: cart.id,
          processedCount: processedItemIds.length,
          remainingCount: remainingItems.length,
        });

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

        // Valor declarado
        const declaredValue = item.insuranceValue ? Number(item.insuranceValue) : 0;

        // Gerar tracking code único (plataforma - customer-facing)
        const platformTrackingCode = `EL${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // Determinar status inicial baseado no tipo de coleta
        const pickupPointId = item.pickupPoint ? (item.pickupPoint as { id?: string | null; [key: string]: unknown }).id : null;
        const hasPickupRequest = (preferences as { pickupRequested?: boolean })?.pickupRequested === true;

        let initialStatus: ShipmentStatus;
        if (hasPickupRequest) {
          initialStatus = ShipmentStatus.PICKUP_REQUESTED;
        } else if (pickupPointId) {
          initialStatus = ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
        } else {
          initialStatus = ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
        }

        // Extrair valor da taxa de coleta (já com comissão aplicada)
        const pickupFeeData = item.pickupFee as { feeAmount?: number } | null;
        const pickupFeeAmount = pickupFeeData?.feeAmount ?? 0;

        // Calcular comissões para reconciliação
        // Os valores de frete e coleta já têm comissão aplicada, precisamos extrair
        const freightCostCents = Math.round(selectedQuote.price * 100);
        const pickupFeeCents = Math.round(pickupFeeAmount * 100);
        const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
          freightCostCents,
          pickupFeeCents
        );

        // Criar shipment COM VOLUMES usando serviço centralizado
        const { shipment, packages } = await createShipmentWithVolumes(tx, {
          shipment: {
            platformTrackingCode,
            carrierTrackingCode: null,
            senderId: session.userId,
            recipientName: destination.nome || destination.apelido || 'Destinatário',
            recipientPhone: destination.telefone,
            recipientEmail: destination.email,
            recipientDocument: destination.documento,
            originCep: originAddress.cep,
            destinationCep: destination.cep,
            destinationAddress: [destination.logradouro, destination.numero, destination.complemento]
              .filter(Boolean)
              .join(', '),
            destinationNeighborhood: destination.bairro,
            destinationCity: destination.cidade,
            destinationState: destination.uf,
            declaredValue,
            carrier: selectedQuote.carrier,
            service: selectedQuote.serviceName || selectedQuote.serviceCode,
            estimatedDays: selectedQuote.deadlineDays,
            freightCost: selectedQuote.price,
            pickupPointId,
            document: {
              originAddress: item.originAddress,
              destination: item.destination,
              volumes: item.volumes,
              preferences: item.preferences,
              selectedQuote: item.selectedQuote,
              totals: item.totals,
            } as Prisma.InputJsonValue,
            status: initialStatus,
            paymentMethod: null,
            // Registrar comissões para reconciliação
            platformShippingCommissionCents: shippingCommissionCents > 0 ? shippingCommissionCents : null,
            platformPickupCommissionCents: pickupCommissionCents > 0 ? pickupCommissionCents : null,
          },
          volumes: volumes.map((vol) => ({
            peso: vol.pesoKg || 0,
            altura: (vol as { alturaCm?: number }).alturaCm || 0,
            largura: (vol as { larguraCm?: number }).larguraCm || 0,
            comprimento: (vol as { comprimentoCm?: number }).comprimentoCm || 0,
          })),
        });

        // Criar etiqueta automaticamente vinculada ao shipment
        // IMPORTANTE: Criar ANTES da integração para que a integração possa atualizar
        await tx.label.create({
          data: {
            shipmentId: shipment.id,
            carrier: selectedQuote.carrier,
            service: selectedQuote.serviceName || selectedQuote.serviceCode || '',
            status: 'pending', // pending até o pagamento ser confirmado
            priceCents: Math.round(selectedQuote.price * 100), // Converter para centavos
            currency: 'BRL',
            trackingCode: platformTrackingCode, // Será atualizado pela integração se sucesso
            recipientName: destination.nome || destination.apelido || 'Destinatário',
            isPrinted: false,
          },
        });

        // 🚚 INTEGRAÇÃO COM TRANSPORTADORA: Criar pré-postagem e obter códigos de rastreio
        // Esta integração é best-effort - se falhar, o checkout continua com código interno
        try {
          // Buscar dados do usuário para nome, CPF/CNPJ, telefone e email
          // IMPORTANTE: O nome do remetente deve ser o nome do USUÁRIO, não do endereço!
          const user = await tx.user.findUnique({
            where: { id: session.userId },
            select: {
              name: true,
              razaoSocial: true, // Para empresas (PJ)
              email: true,
              phone: true,
              cpf: true,
              cnpj: true,
            },
          });

          // Extrair dados do remetente do originAddress do item
          // IMPORTANTE: originAddress já vem com dados completos do endereço
          // selecionado em /cotações (não precisamos buscar novamente do banco)
          const originData = item.originAddress as {
            cep: string;
            logradouro?: string;
            numero?: string;
            complemento?: string;
            bairro?: string;
            cidade?: string;
            uf?: string;
            nome?: string; // label/apelido do endereço
          };

          // Determinar documento do remetente
          // Prioridade: Se CNPJ preenchido → CNPJ, senão → CPF
          const senderDocumento =
            (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
            user?.cpf ||
            '';

          // Dados do remetente - usa dados pessoais do User + endereço do originAddress
          // IMPORTANTE: O nome do remetente deve ser o nome do USUÁRIO cadastrado em /minha-conta
          // NÃO usar originData.nome pois esse é apenas o apelido/label do endereço (ex: "Casa", "Trabalho")
          const senderData = {
            nome: user?.razaoSocial || user?.name || 'Remetente',
            documento: senderDocumento.replace(/\D/g, ''), // Remove formatação
            telefone: user?.phone || undefined,
            email: user?.email || undefined,
            cep: originData.cep.replace(/\D/g, ''),
            logradouro: originData.logradouro || undefined,
            numero: originData.numero || undefined,
            complemento: originData.complemento || undefined,
            bairro: originData.bairro || undefined,
            cidade: originData.cidade || undefined,
            uf: originData.uf || undefined,
          };

          console.log('[CART_CHECKOUT] Sender data:', {
            shipmentId: shipment.id,
            hasUserData: !!user,
            documento: senderData.documento ? `${senderData.documento.substring(0, 3)}***` : 'MISSING',
            nome: senderData.nome,
            cep: senderData.cep,
            logradouro: senderData.logradouro,
          });

          // Dados do destinatário
          const recipientData = {
            nome: destination.nome || destination.apelido || 'Destinatário',
            documento: destination.documento,
            telefone: destination.telefone,
            email: destination.email,
            cep: destination.cep,
            logradouro: destination.logradouro,
            numero: destination.numero,
            complemento: destination.complemento,
            bairro: destination.bairro,
            cidade: destination.cidade,
            uf: destination.uf,
          };

          // Chamar integração com transportadora
          const integrationResult = await integrateWithCarrier(tx, {
            shipmentId: shipment.id,
            carrier: selectedQuote.carrier,
            serviceName: selectedQuote.serviceName || '',
            serviceCode: selectedQuote.serviceCode,
            packages,
            sender: senderData,
            recipient: recipientData,
            declaredValue,
            contentDescription: 'Mercadorias diversas',
          });

          if (integrationResult.success) {
            console.log('[CART_CHECKOUT] Carrier integration successful:', {
              shipmentId: shipment.id,
              carrier: selectedQuote.carrier,
              primaryTrackingCode: integrationResult.primaryTrackingCode,
              packagesUpdated: integrationResult.packageUpdates?.length || 0,
            });
          } else {
            // Log de falha mas não interrompe o checkout
            console.warn('[CART_CHECKOUT] Carrier integration failed (non-blocking):', {
              shipmentId: shipment.id,
              carrier: selectedQuote.carrier,
              error: integrationResult.errorMessage,
              errors: integrationResult.errors,
            });
          }
        } catch (integrationError) {
          // Erro na integração não deve impedir o checkout
          console.error('[CART_CHECKOUT] Carrier integration error (non-blocking):', {
            shipmentId: shipment.id,
            carrier: selectedQuote.carrier,
            error: integrationError instanceof Error ? integrationError.message : integrationError,
          });
        }

        // Se coleta foi solicitada, criar PickupRequest
        if (hasPickupRequest) {
          const pickupFee = item.pickupFee as { collectorId?: string } | null;
          const collectorId = pickupFee?.collectorId || null;

          // Verificar se já existe coleta para este shipment (idempotência)
          const existingPickup = await tx.pickupRequest.findUnique({
            where: { shipmentId: shipment.id },
          });

          if (!existingPickup) {
            await tx.pickupRequest.create({
              data: {
                userId: session.userId,
                shipmentId: shipment.id,
                collectorId: collectorId,
                originCep: originAddress.cep,
                originAddress: null, // Endereço completo está no shipment.document
                originCity: typeof originAddress.cidade === 'string' ? originAddress.cidade : null,
                originUf: typeof originAddress.uf === 'string' ? originAddress.uf : null,
                status: 'PENDING',
                notes: null,
              },
            });
          }
        }

        // Criar evento inicial de rastreamento
        await createInitialTrackingEvent(tx, shipment.id, initialStatus, new Date());

        shipmentIds.push(shipment.id);

        // Usar totals.total que inclui frete, pickupFee, seguros, etc.
        const itemTotals = item.totals as { total?: number };
        const itemTotal = itemTotals?.total;

        if (!itemTotal || itemTotal <= 0) {
          throw new Error(`INVALID_ITEM_TOTAL: Item ${item.id} has invalid total: ${itemTotal}`);
        }

        totalAmount += itemTotal;
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

      // ✅ CRITICAL FIX: Remover itens processados DENTRO da transação
      // Isso garante atomicidade - se o checkout foi bem-sucedido, os itens são removidos
      const processedItemIds = itemsToCheckout.map((item) => item.id);
      await tx.cartItem.deleteMany({
        where: {
          id: { in: processedItemIds },
          cartId: cart.id,
        },
      });

      // Atualizar totais do carrinho (zerar se todos os itens foram processados)
      const remainingItems = await tx.cartItem.findMany({
        where: { cartId: cart.id },
      });

      if (remainingItems.length === 0) {
        // Todos os itens foram processados - resetar carrinho
        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: 'OPEN',
            totals: { total: 0, moeda: 'BRL' },
          },
        });
      } else {
        // Ainda há itens - recalcular totais
        const newTotal = remainingItems.reduce((sum, item) => {
          const itemTotals = item.totals as { total?: number };
          return sum + (itemTotals?.total || 0);
        }, 0);
        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: 'OPEN',
            totals: { total: newTotal, moeda: 'BRL' },
          },
        });
      }

      console.log('[CART_CHECKOUT] Items removidos após checkout:', {
        cartId: cart.id,
        processedCount: processedItemIds.length,
        remainingCount: remainingItems.length,
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

    // 🛡️ CRITICAL FIX: Liberar carrinho do estado LOCKED em caso de falha
    // Isso evita que carrinhos fiquem travados permanentemente
    try {
      const session = await getSession();
      if (session?.userId) {
        await prisma.cart.updateMany({
          where: {
            userId: session.userId,
            status: 'LOCKED',
          },
          data: {
            status: 'OPEN',
          },
        });
      }
    } catch (unlockError) {
      console.error('[CART_CHECKOUT] Erro ao destravar carrinho:', unlockError);
    }

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

      if (error.message === 'INSUFFICIENT_WALLET_BALANCE') {
        return NextResponse.json(
          { message: 'Saldo insuficiente na carteira para processar o checkout' },
          { status: 402 } // 402 Payment Required
        );
      }
    }

    return NextResponse.json(
      { message: 'Erro ao processar checkout' },
      { status: 500 }
    );
  }
}
