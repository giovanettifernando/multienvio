export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';

// Schema de validação do checkout
const checkoutSchema = z.object({
  quoteId: z.string(),
  recipient: z.object({
    nome: z.string(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    documento: z.string().optional(),
    cep: z.string(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string(),
    uf: z.string(),
  }),
  document: z.object({
    type: z.enum(['NFE', 'DECLARACAO']),
    nfeKeys: z.array(z.object({ chave: z.string() })).optional(),
    declarationItems: z.array(z.object({
      descricao: z.string(),
      valorUnitario: z.number(),
      quantidade: z.number(),
    })).optional(),
  }),
  volumes: z.array(z.object({
    peso: z.number(),
    altura: z.number(),
    largura: z.number(),
    comprimento: z.number(),
  })),
  insuranceValue: z.number().optional(),
  pickupPointId: z.string().optional().nullable(),
  carrier: z.string(),
  service: z.string(),
  originCep: z.string(),
  originCidade: z.string().optional(),
  originUf: z.string().optional(),
  destinationCep: z.string(),
  estimatedDays: z.number(),
  freightCost: z.number(),
  solicitarColeta: z.boolean().optional().default(false), // Solicitar coleta na origem
});

type CheckoutPayload = z.infer<typeof checkoutSchema>;

/**
 * POST /api/checkout
 * Cria envio (shipment) e registra transação financeira
 */
export async function POST(request: Request) {
  try {
    // Autenticar usuário
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Parse e validar payload
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: CheckoutPayload = parsed.data;

    // Calcular peso e valor total
    const totalWeight = data.volumes.reduce((sum, vol) => sum + vol.peso, 0);
    const declaredValue = data.insuranceValue ?? (
      data.document.type === 'DECLARACAO' && data.document.declarationItems
        ? data.document.declarationItems.reduce((sum, item) => sum + (item.valorUnitario * item.quantidade), 0)
        : 0
    );

    // Gerar tracking code único
    const trackingCode = `BR${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Preparar documento (priorizar NFE se ambos estiverem preenchidos)
    const documentData: {
      type: string;
      nfeKeys?: string[];
      declarationItems?: Array<{ descricao: string; valorUnitario: number; quantidade: number }>;
    } = {
      type: data.document.type,
    };

    if (data.document.type === 'NFE' && data.document.nfeKeys && data.document.nfeKeys.length > 0) {
      documentData.nfeKeys = data.document.nfeKeys.map(k => k.chave);
    } else if (data.document.type === 'DECLARACAO' && data.document.declarationItems) {
      documentData.declarationItems = data.document.declarationItems;
    }

    // Criar shipment dentro de uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Obter ou criar carteira do usuário
      let wallet = await tx.wallet.findUnique({
        where: { userId: session.userId },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: session.userId,
            availableCents: 0,
            pendingCents: 0,
          },
        });
      }

      // Criar envio
      const shipment = await tx.shipment.create({
        data: {
          trackingCode,
          sender: {
            connect: { id: session.userId },
          },
          recipientName: data.recipient.nome,
          recipientPhone: data.recipient.telefone ?? null,
          recipientEmail: data.recipient.email ?? null,
          recipientDocument: data.recipient.documento ?? null,
          originCep: data.originCep,
          destinationCep: data.destinationCep,
          destinationAddress: [
            data.recipient.logradouro,
            data.recipient.numero,
            data.recipient.complemento,
          ].filter(Boolean).join(', ') || null,
          destinationNeighborhood: data.recipient.bairro ?? null,
          destinationCity: data.recipient.cidade,
          destinationState: data.recipient.uf,
          weight: totalWeight,
          declaredValue,
          carrier: data.carrier,
          service: data.service,
          estimatedDays: data.estimatedDays,
          freightCost: data.freightCost,
          pickupPointId: data.pickupPointId,
          document: documentData,
          status: 'pending_payment', // aguardando pagamento
          paymentMethod: null, // Será preenchido após pagamento
        },
      });

      // Criar etiqueta automaticamente vinculada ao shipment
      const label = await tx.label.create({
        data: {
          shipmentId: shipment.id,
          carrier: data.carrier,
          service: data.service,
          status: 'pending', // pending até o pagamento ser confirmado
          priceCents: Math.round(data.freightCost * 100), // Converter para centavos
          currency: 'BRL',
          trackingCode: trackingCode,
          recipientName: data.recipient.nome, // Nome do destinatário denormalizado
          isPrinted: false,
        },
      });

      // Se solicitarColeta estiver ativado, criar PickupRequest
      let pickupRequest = null;
      if (data.solicitarColeta) {
        // Verificar se já existe coleta para este shipment (idempotência)
        const existingPickup = await tx.pickupRequest.findUnique({
          where: { shipmentId: shipment.id },
        });

        if (!existingPickup) {
          // Para coleta normal: usar dados de ORIGEM
          // Para logística reversa: usar dados de DESTINO (onde será feita a coleta)
          // Por enquanto, assumimos coleta normal (pickup na origem)
          pickupRequest = await tx.pickupRequest.create({
            data: {
              userId: session.userId,
              shipmentId: shipment.id,
              originCep: data.originCep,
              originAddress: null, // Endereço completo não disponível no payload
              originCity: data.originCidade || null,
              originUf: data.originUf || null,
              status: 'PENDING',
              notes: null,
            },
          });
        } else {
          pickupRequest = existingPickup;
        }
      }

      // Nota: A transação financeira será criada pelo /api/wallet/debit
      // quando o usuário confirmar o pagamento no modal

      return { shipment, label, pickupRequest };
    });

    // Verificar se há integração de pagamento configurada
    const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED === 'true';
    const paymentGatewayUrl = process.env.PAYMENT_GATEWAY_URL;

    if (paymentGatewayEnabled && paymentGatewayUrl) {
      const paymentUrl = `${paymentGatewayUrl}/pay/${result.shipment.id}`;

      return NextResponse.json({
        shipmentId: result.shipment.id,
        trackingCode: result.shipment.trackingCode,
        paymentUrl,
        source: 'gateway',
      });
    }

    // Nota: Pagamento não é mais processado aqui.
    // O modal de checkout irá chamar /api/wallet/debit para processar o pagamento.

    // Outros métodos: retornar info do envio
    return NextResponse.json({
      shipmentId: result.shipment.id,
      trackingCode: result.shipment.trackingCode,
      publicTrackingId: result.shipment.publicTrackingId,
      trackingUrl: `/rastreio/${result.shipment.publicTrackingId}`,
      source: 'mock',
      message: 'Envio criado. Aguardando confirmação de pagamento.',
    });
  } catch (error) {
    console.error('[CHECKOUT_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar checkout';
    return NextResponse.json({ message }, { status: 500 });
  }
}
