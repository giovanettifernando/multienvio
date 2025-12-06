/**
 * API Admin - Sincronizar Agências dos Correios
 *
 * POST /api/admin/correios-agencies/sync
 * Sincroniza agências do banco com a API dos Correios
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import {
  listarTodasAgencias,
  mapStatusToEnum,
  mapTipoSiglaToEnum,
  type CorreiosAgenciaAPI,
} from '@/lib/correios/agencia-client';

// UFs do Brasil para sincronização
const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    // Parâmetros opcionais
    const body = await request.json().catch(() => ({}));
    const ufsToSync = body.ufs as string[] | undefined;
    const clearBefore = body.clearBefore as boolean | undefined;

    const targetUfs = ufsToSync && ufsToSync.length > 0 ? ufsToSync : UFS_BRASIL;

    console.log('[SYNC_AGENCIES] Iniciando sincronização:', {
      ufs: targetUfs,
      clearBefore,
      by: session.staffId,
    });

    const startTime = Date.now();
    const syncedAt = new Date();
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errors: Array<{ uf: string; error: string }> = [];

    // Opcional: limpar antes de sincronizar
    if (clearBefore) {
      const deleted = await prisma.correiosAgency.deleteMany({
        where: targetUfs.length < UFS_BRASIL.length ? { uf: { in: targetUfs } } : undefined,
      });
      console.log('[SYNC_AGENCIES] Registros removidos:', deleted.count);
    }

    // Sincronizar por UF
    for (const uf of targetUfs) {
      try {
        console.log(`[SYNC_AGENCIES] Buscando agências de ${uf}...`);

        const agencias = await listarTodasAgencias({ uf, status: 2 });

        console.log(`[SYNC_AGENCIES] ${uf}: ${agencias.length} agências encontradas`);

        // Upsert em lote
        for (const agencia of agencias) {
          try {
            const data = mapAgenciaToDb(agencia, syncedAt);

            await prisma.correiosAgency.upsert({
              where: { id: agencia.id },
              create: data,
              update: {
                ...data,
                createdAt: undefined, // Não atualizar createdAt
              },
            });

            // Contar como criado ou atualizado (aproximação)
            totalUpdated++;
          } catch (err) {
            console.error(`[SYNC_AGENCIES] Erro ao salvar agência ${agencia.id}:`, err);
            totalErrors++;
          }
        }

        totalCreated += agencias.length;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`[SYNC_AGENCIES] Erro ao sincronizar UF ${uf}:`, err);
        errors.push({ uf, error: errorMsg });
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;

    console.log('[SYNC_AGENCIES] Sincronização concluída:', {
      duration: `${duration}ms`,
      totalAgencias: totalCreated,
      totalUpdated,
      totalErrors,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída em ${Math.round(duration / 1000)}s`,
      stats: {
        ufsProcessadas: targetUfs.length,
        agenciasProcessadas: totalCreated,
        erros: totalErrors,
        duration,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[SYNC_AGENCIES] Erro fatal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

/**
 * Mapeia agência da API para formato do banco
 */
function mapAgenciaToDb(agencia: CorreiosAgenciaAPI, syncedAt: Date) {
  // Extrair latitude/longitude do endereço ou do objeto raiz
  const latitude = agencia.endereco.latitude
    ? parseFloat(agencia.endereco.latitude)
    : agencia.latitude || null;
  const longitude = agencia.endereco.longitude
    ? parseFloat(agencia.endereco.longitude)
    : agencia.longitude || null;

  // Extrair horários do objeto horarios ou do objeto raiz
  const horarioFuncionamento = agencia.horarios?.funcionamento || agencia.horarioFuncionamento || null;
  const iniExpediente = agencia.horarios?.iniExpediente || agencia.iniExpediente || null;
  const fimExpediente = agencia.horarios?.fimExpediente || agencia.fimExpediente || null;

  return {
    id: agencia.id,
    nome: agencia.nome,
    status: mapStatusToEnum(agencia.status),
    statusCodigo: parseInt(String(agencia.status), 10) || 0,
    statusDescricao: agencia.descStatus || null,
    tipoUnidadeCodigo: agencia.tipoUnidade.codigo,
    tipoUnidadeDescricao: agencia.tipoUnidade.descricao || null,
    tipoUnidadeSigla: mapTipoSiglaToEnum(agencia.tipoUnidade.sigla),
    cep: agencia.endereco.cep.replace(/\D/g, ''),
    uf: agencia.endereco.uf,
    municipio: agencia.endereco.municipio || agencia.endereco.localidade || '',
    bairro: agencia.endereco.bairro || null,
    logradouro: agencia.endereco.logradouro || null,
    numero: agencia.endereco.numero || null,
    complemento: agencia.endereco.complemento || null,
    latitude,
    longitude,
    horarioFuncionamento,
    iniExpediente,
    fimExpediente,
    syncedAt,
  };
}
