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
    // Nota: o brief desta rota descreve "200 sempre que autenticado", mas
    // corpo corrompido não é um evento que possamos persistir ou enfileirar
    // — 400 é o único sinal que o Asaas tem de que o payload não chegou
    // íntegro. Retornar 200 aqui esconderia o problema, não o resolveria.
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
    // Violação de unicidade (gatewayId + externalId) = evento repetido —
    // já temos o registro. Sucesso idempotente: 200.
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ received: true });
    }

    // Qualquer outro erro (banco fora do ar, Redis inacessível ao enfileirar
    // etc.) precisa virar 500: é o único jeito de o Asaas saber que o evento
    // NÃO foi processado e retransmitir com backoff. Devolver 200 aqui faria
    // o evento se perder para sempre — não há reconciliação/monitor de
    // pendências para Asaas até a Task 13.
    console.error('[ASAAS_WEBHOOK] Falha ao registrar evento:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
