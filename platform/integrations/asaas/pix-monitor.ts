import 'server-only';
import { prisma as defaultPrisma } from '@/platform/db/db';
import { getCharge as defaultGetCharge } from './charges';
import { mapAsaasStatus } from './status';
import { toCents } from './money';

export interface MonitorDeps {
  prisma?: typeof defaultPrisma;
  getCharge?: typeof defaultGetCharge;
}

/**
 * Varre transações pendentes e sincroniza com o Asaas.
 *
 * Rede de segurança do sistema de webhooks: se o Asaas pausar a fila (15
 * falhas consecutivas) ou um evento se perder, é esta varredura que resgata o
 * pagamento. Cobre PIX (pago fora do nosso fluxo) e boleto — tanto a
 * compensação (1 a 3 dias úteis) quanto o vencimento sem pagamento, que não
 * gera webhook confiável e por isso só é cancelado por aqui.
 */
export async function syncPendingCharges(
  deps: MonitorDeps = {},
): Promise<{ checked: number; updated: number; expired: number }> {
  const db = deps.prisma ?? defaultPrisma;
  const getCharge = deps.getCharge ?? defaultGetCharge;

  const pending = await db.paymentTransaction.findMany({
    where: { status: 'PENDING', externalId: { not: null } },
    select: { id: true, externalId: true, amountCents: true, method: true },
  });

  let updated = 0;
  let expired = 0;

  for (const tx of pending) {
    if (!tx.externalId) continue;

    // Falha em UMA cobrança (rede, 404) não pode abortar a varredura das
    // demais — cada iteração é isolada, loga e segue para a próxima.
    try {
      const charge = await getCharge(tx.externalId);
      const status = mapAsaasStatus(charge.status);

      if (status === 'PENDING') continue;

      const netCents = charge.netValue != null ? toCents(charge.netValue) : tx.amountCents;
      // A taxa é a diferença entre bruto e líquido. Nunca deixar negativa: um
      // netValue maior que o value seria resposta inesperada da API, e taxa
      // negativa contaminaria relatório financeiro (mesma guarda de tracking.ts).
      const feeCents = Math.max(0, tx.amountCents - netCents);

      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status,
          netCents,
          feeCents,
          paidAt: status === 'PAID' ? new Date() : undefined,
          authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
        },
      });

      updated += 1;
      if (status === 'CANCELED') expired += 1;
    } catch (error) {
      console.error(`[ASAAS_MONITOR] Falha ao consultar ${tx.externalId}:`, error);
    }
  }

  return { checked: pending.length, updated, expired };
}
