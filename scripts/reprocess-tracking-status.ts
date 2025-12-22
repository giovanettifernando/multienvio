/**
 * Script de Reprocessamento de Status de Rastreamento
 *
 * Reprocessa todos os shipments dos Correios usando a derivadora de estado
 * para corrigir status incorretos baseados na timeline de eventos.
 *
 * Uso:
 *   npx tsx scripts/reprocess-tracking-status.ts --dry-run
 *   npx tsx scripts/reprocess-tracking-status.ts --apply
 *
 * Flags:
 *   --dry-run  Mostra o que seria alterado sem aplicar (padrão)
 *   --apply    Aplica as alterações no banco de dados
 *   --verbose  Mostra detalhes de cada shipment processado
 *   --limit N  Limita a N shipments (para teste)
 */

import { prisma } from './lib/db';
import {
  deriveCorreiosTrackingState,
  TrackingPhase,
  type TrackingEventInput,
} from '../modules/tracking/application/derive-tracking-state';
import { ShipmentStatus } from '../modules/shipments/application/shipment-status';

// ============================================================================
// Tipos
// ============================================================================

interface ShipmentChange {
  shipmentId: string;
  platformTrackingCode: string;
  carrierTrackingCode: string;
  currentStatus: string;
  derivedStatus: string;
  currentPhase: string;
  derivedPhase: TrackingPhase;
  eventsCount: number;
  milestones: {
    current: {
      postedAt: Date | null;
      deliveredAt: Date | null;
    };
    derived: {
      postedAt: Date | null;
      deliveredAt: Date | null;
    };
  };
  sourceEvent: string | null;
  unknownEventsCount: number;
}

interface ReprocessReport {
  totalProcessed: number;
  totalWithChanges: number;
  totalWithStatusChange: number;
  totalWithMilestoneChange: number;
  totalWithUnknownEvents: number;
  changes: ShipmentChange[];
  unknownEventsSummary: Map<string, number>;
}

// ============================================================================
// Funções auxiliares
// ============================================================================

function parseArgs(): { dryRun: boolean; verbose: boolean; limit?: number } {
  const args = process.argv.slice(2);
  const hasApply = args.includes('--apply');
  const hasDryRun = args.includes('--dry-run');
  const hasVerbose = args.includes('--verbose');

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  // Default to dry-run if neither flag specified
  const dryRun = hasApply ? false : true;

  if (hasApply && hasDryRun) {
    console.error('Erro: Não pode usar --apply e --dry-run juntos');
    process.exit(1);
  }

  return { dryRun, verbose: hasVerbose, limit };
}

function dbEventToInput(event: {
  type: string;
  description: string;
  city: string | null;
  uf: string | null;
  occurredAt: Date;
}): TrackingEventInput {
  return {
    codigo: event.type,
    descricao: event.description,
    dataHora: event.occurredAt,
    cidade: event.city,
    uf: event.uf,
  };
}

function phaseToString(phase: TrackingPhase): string {
  const names: Record<TrackingPhase, string> = {
    [TrackingPhase.UNKNOWN]: 'UNKNOWN',
    [TrackingPhase.AWAITING_DROP_OFF]: 'AWAITING_DROP_OFF',
    [TrackingPhase.POSTED]: 'POSTED',
    [TrackingPhase.IN_TRANSFER]: 'IN_TRANSFER',
    [TrackingPhase.OUT_FOR_DELIVERY]: 'OUT_FOR_DELIVERY',
    [TrackingPhase.DELIVERED]: 'DELIVERED',
    [TrackingPhase.RETURNED]: 'RETURNED',
    [TrackingPhase.PROBLEM]: 'PROBLEM',
  };
  return names[phase] || 'UNKNOWN';
}

// ============================================================================
// Processamento principal
// ============================================================================

async function reprocessShipments(
  dryRun: boolean,
  verbose: boolean,
  limit?: number
): Promise<ReprocessReport> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  REPROCESSAMENTO DE STATUS DE RASTREAMENTO`);
  console.log(`  Modo: ${dryRun ? 'DRY-RUN (simulação)' : 'APPLY (aplicando alterações)'}`);
  console.log(`${'='.repeat(70)}\n`);

  // Buscar shipments dos Correios
  const shipments = await prisma.shipment.findMany({
    where: {
      carrierTrackingCode: {
        not: null,
        endsWith: 'BR',
      },
    },
    select: {
      id: true,
      platformTrackingCode: true,
      carrierTrackingCode: true,
      status: true,
      postedAt: true,
      deliveredAt: true,
      trackingEvents: {
        orderBy: { occurredAt: 'asc' },
        select: {
          type: true,
          description: true,
          city: true,
          uf: true,
          occurredAt: true,
        },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Encontrados ${shipments.length} shipments dos Correios para processar.\n`);

  const report: ReprocessReport = {
    totalProcessed: 0,
    totalWithChanges: 0,
    totalWithStatusChange: 0,
    totalWithMilestoneChange: 0,
    totalWithUnknownEvents: 0,
    changes: [],
    unknownEventsSummary: new Map(),
  };

  for (const shipment of shipments) {
    report.totalProcessed++;

    // Converter eventos para formato da derivadora
    const events: TrackingEventInput[] = shipment.trackingEvents.map(dbEventToInput);

    // Derivar estado
    const derivedState = deriveCorreiosTrackingState(events);

    // Verificar se há mudanças
    const statusChanged = derivedState.currentStatus !== shipment.status;
    const postedAtChanged =
      derivedState.milestones.postedAt !== null &&
      shipment.postedAt === null;
    const deliveredAtChanged =
      derivedState.milestones.deliveredAt !== null &&
      shipment.deliveredAt === null;
    const hasChanges = statusChanged || postedAtChanged || deliveredAtChanged;

    // Coletar eventos desconhecidos
    for (const unk of derivedState.unknownEvents) {
      const key = `${unk.codigo || 'null'}|${unk.descricao}`;
      report.unknownEventsSummary.set(
        key,
        (report.unknownEventsSummary.get(key) || 0) + 1
      );
    }

    if (derivedState.unknownEvents.length > 0) {
      report.totalWithUnknownEvents++;
    }

    if (hasChanges) {
      report.totalWithChanges++;
      if (statusChanged) report.totalWithStatusChange++;
      if (postedAtChanged || deliveredAtChanged) report.totalWithMilestoneChange++;

      const change: ShipmentChange = {
        shipmentId: shipment.id,
        platformTrackingCode: shipment.platformTrackingCode,
        carrierTrackingCode: shipment.carrierTrackingCode!,
        currentStatus: shipment.status,
        derivedStatus: derivedState.currentStatus,
        currentPhase: shipment.status,
        derivedPhase: derivedState.phase,
        eventsCount: events.length,
        milestones: {
          current: {
            postedAt: shipment.postedAt,
            deliveredAt: shipment.deliveredAt,
          },
          derived: {
            postedAt: derivedState.milestones.postedAt,
            deliveredAt: derivedState.milestones.deliveredAt,
          },
        },
        sourceEvent: derivedState.sourceEvent?.descricao || null,
        unknownEventsCount: derivedState.unknownEvents.length,
      };

      report.changes.push(change);

      // Aplicar mudanças se não é dry-run
      if (!dryRun) {
        const updateData: Record<string, unknown> = {};
        if (statusChanged) {
          updateData.status = derivedState.currentStatus;
        }
        if (postedAtChanged) {
          updateData.postedAt = derivedState.milestones.postedAt;
        }
        if (deliveredAtChanged) {
          updateData.deliveredAt = derivedState.milestones.deliveredAt;
        }

        await prisma.shipment.update({
          where: { id: shipment.id },
          data: updateData,
        });
      }
    }

    // Log verbose
    if (verbose) {
      const statusIcon = hasChanges ? '🔄' : '✅';
      console.log(
        `${statusIcon} ${shipment.platformTrackingCode} | ` +
          `${shipment.status} → ${derivedState.currentStatus} | ` +
          `${events.length} eventos`
      );
    }
  }

  return report;
}

// ============================================================================
// Geração de relatório
// ============================================================================

function printReport(report: ReprocessReport, dryRun: boolean): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RELATÓRIO ${dryRun ? '(SIMULAÇÃO)' : '(APLICADO)'}`);
  console.log(`${'='.repeat(70)}\n`);

  console.log(`📊 Resumo:`);
  console.log(`   Total processado:       ${report.totalProcessed}`);
  console.log(`   Com alterações:         ${report.totalWithChanges}`);
  console.log(`   - Status alterado:      ${report.totalWithStatusChange}`);
  console.log(`   - Milestones alterados: ${report.totalWithMilestoneChange}`);
  console.log(`   Com eventos desconhecidos: ${report.totalWithUnknownEvents}`);

  if (report.changes.length > 0) {
    console.log(`\n📝 Detalhes das alterações:\n`);
    console.log(
      `${'─'.repeat(100)}`
    );
    console.log(
      `  ${'Código EL'.padEnd(25)} | ${'Correios'.padEnd(15)} | ${'Status Atual'.padEnd(30)} → ${'Status Derivado'.padEnd(30)}`
    );
    console.log(
      `${'─'.repeat(100)}`
    );

    for (const change of report.changes) {
      const statusChange =
        change.currentStatus !== change.derivedStatus
          ? `${change.currentStatus.padEnd(30)} → ${change.derivedStatus}`
          : `(sem mudança de status)`;

      console.log(
        `  ${change.platformTrackingCode.padEnd(25)} | ${change.carrierTrackingCode.padEnd(15)} | ${statusChange}`
      );

      // Mostrar mudanças de milestones
      if (
        change.milestones.derived.postedAt &&
        !change.milestones.current.postedAt
      ) {
        console.log(
          `     ↳ postedAt: null → ${change.milestones.derived.postedAt.toISOString()}`
        );
      }
      if (
        change.milestones.derived.deliveredAt &&
        !change.milestones.current.deliveredAt
      ) {
        console.log(
          `     ↳ deliveredAt: null → ${change.milestones.derived.deliveredAt.toISOString()}`
        );
      }
    }
    console.log(`${'─'.repeat(100)}`);
  }

  // Eventos desconhecidos
  if (report.unknownEventsSummary.size > 0) {
    console.log(`\n⚠️  Eventos desconhecidos (para mapeamento futuro):\n`);
    const sorted = Array.from(report.unknownEventsSummary.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [key, count] of sorted) {
      const [codigo, descricao] = key.split('|');
      console.log(`   [${codigo}] "${descricao}" (${count}x)`);
    }
  }

  // Instruções finais
  console.log(`\n${'='.repeat(70)}`);
  if (dryRun) {
    console.log(`  ⏸️  MODO DRY-RUN - Nenhuma alteração foi aplicada`);
    console.log(`  Para aplicar as alterações, execute com --apply`);
  } else {
    console.log(`  ✅ ALTERAÇÕES APLICADAS`);
    console.log(`  ${report.totalWithChanges} shipment(s) atualizados`);
  }
  console.log(`${'='.repeat(70)}\n`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { dryRun, verbose, limit } = parseArgs();

  try {
    const report = await reprocessShipments(dryRun, verbose, limit);
    printReport(report, dryRun);
  } catch (error) {
    console.error('Erro ao processar:', error);
    process.exit(1);
  }
}

main();
