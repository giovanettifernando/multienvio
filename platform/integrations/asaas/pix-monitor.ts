import 'server-only';
import { prisma as defaultPrisma } from '@/platform/db/db';
import { getCharge as defaultGetCharge } from './charges';
import { mapAsaasStatus } from './status';
import { toCents } from './money';
import { canReleaseService } from './release';
import { AsaasApiError } from './types';

export interface MonitorDeps {
  prisma?: typeof defaultPrisma;
  getCharge?: typeof defaultGetCharge;
}

// Abaixo desta idade, um 404 do Asaas é tratado como suspeita de configuração
// (chave de API do ambiente errado — sandbox vs produção), não como cobrança
// deletada. Cobrança recém-criada não some sozinha; a transação só é
// considerada "confirmadamente inexistente" depois de sobreviver 1h em PENDING.
const NOT_FOUND_MIN_AGE_MS = 60 * 60 * 1000;

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
): Promise<{
  checked: number;
  updated: number;
  expired: number;
  notFound: number;
  /** Transações que passaram a estar liberadas nesta varredura. */
  releasedTransactionIds: string[];
}> {
  const db = deps.prisma ?? defaultPrisma;
  const getCharge = deps.getCharge ?? defaultGetCharge;

  const pending = await db.paymentTransaction.findMany({
    where: { status: 'PENDING', externalId: { not: null } },
    select: { id: true, externalId: true, amountCents: true, createdAt: true },
  });

  let updated = 0;
  let expired = 0;
  let notFound = 0;
  const releasedTransactionIds: string[] = [];

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
      // Quem consome (o worker) precisa saber quais foram LIBERADAS para
      // disparar o efeito de negócio — creditar a carteira, no caso de recarga.
      // O monitor não faz isso aqui de propósito: este módulo fala com o
      // gateway e não deve conhecer carteira nem envio.
      if (canReleaseService(status)) releasedTransactionIds.push(tx.id);
    } catch (error) {
      if (error instanceof AsaasApiError && error.statusCode === 404) {
        const ageMs = Date.now() - tx.createdAt.getTime();

        if (ageMs > NOT_FOUND_MIN_AGE_MS) {
          // A cobrança não existe mais no gateway e já teve tempo de sobra
          // para não ser ruído de configuração — ela jamais será paga.
          // Sem isso, a transação ficaria presa em PENDING para sempre,
          // com o único sinal sendo este log que ninguém acompanha.
          await db.paymentTransaction.update({
            where: { id: tx.id },
            data: { status: 'CANCELED' },
          });
          notFound += 1;
          console.error(
            `[ASAAS_MONITOR] cobrança ${tx.externalId} não existe no Asaas (404) — transação ${tx.id} cancelada`,
          );
        } else {
          // Transação recém-criada com 404 é quase sempre chave de API
          // apontando para o ambiente errado (sandbox vs produção), não
          // deleção real — mantém PENDING e deixa em retry.
          console.error(
            `[ASAAS_MONITOR] cobrança ${tx.externalId} retornou 404 mas a transação ${tx.id} tem menos de 1h — mantendo PENDING (possível ambiente de API incorreto)`,
          );
        }
        continue;
      }

      console.error(`[ASAAS_MONITOR] Falha ao consultar ${tx.externalId}:`, error);
    }
  }

  return { checked: pending.length, updated, expired, notFound, releasedTransactionIds };
}
