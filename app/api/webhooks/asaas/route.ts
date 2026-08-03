/**
 * POST /api/webhooks/asaas
 *
 * Recebe eventos de cobrança do Asaas.
 *
 * Regras impostas pelo provedor:
 * - Responder 2xx o mais rápido possível; após 15 falhas seguidas a fila é pausada
 * - Entrega é at-least-once — o mesmo evento pode chegar mais de uma vez
 * Por isso: valida, persiste o evento e enfileira. O processamento é do worker.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/platform/db/db';
import {
  getAsaasConfig,
  verifyWebhookToken,
  extractChargeFromPayload,
  isRelevantEvent,
} from '@/platform/integrations/asaas';
import { enqueueAsaasWebhook } from '@/platform/queue';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const config = await getAsaasConfig();
  const received = req.headers.get('asaas-access-token');

  if (!verifyWebhookToken(received, config?.webhookToken)) {
    console.warn('[ASAAS_WEBHOOK] Token inválido ou ausente');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const event = (payload as { event?: string }).event ?? '';
  const charge = extractChargeFromPayload(payload);

  if (!charge || !isRelevantEvent(event)) {
    // Evento informativo ou sem cobrança: confirmar para não travar a fila do Asaas
    return NextResponse.json({ received: true });
  }

  const gateway = await prisma.paymentGateway.findFirst({ where: { slug: 'asaas' } });
  if (!gateway) return NextResponse.json({ received: true });

  try {
    await prisma.paymentWebhook.create({
      data: {
        gatewayId: gateway.id,
        eventType: event,
        externalId: charge.id,
        payload: payload as never,
        status: 'PENDING',
      },
    });
    await enqueueAsaasWebhook({ chargeId: charge.id, event });
  } catch (error) {
    // Violação de unicidade (gatewayId + externalId) = evento repetido. Já temos.
    const code = (error as { code?: string }).code;
    if (code !== 'P2002') {
      console.error('[ASAAS_WEBHOOK] Falha ao registrar evento:', error);
    }
  }

  return NextResponse.json({ received: true });
}
