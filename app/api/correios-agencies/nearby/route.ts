/**
 * API Pública - Agências dos Correios Próximas
 *
 * GET /api/correios-agencies/nearby
 * Busca agências ativas por UF/município para uso na finalização de cotação
 *
 * Parâmetros:
 * - uf: Sigla do estado (obrigatório)
 * - municipio: Nome do município (opcional)
 * - limit: Limite de resultados (padrão: 10, máximo: 50)
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';

interface CorreiosAgency {
  id: string;
  nome: string;
  tipoUnidadeSigla: string | null;
  tipoUnidadeDescricao: string | null;
  cep: string;
  uf: string;
  municipio: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
  horarioFuncionamento: string | null;
  iniExpediente: string | null;
  fimExpediente: string | null;
  enderecoCompleto: string;
}

interface CorreiosAgenciesResponse {
  agencies: CorreiosAgency[];
  total: number;
  uf: string;
  municipio: string | null;
}

/**
 * Remove acentos de uma string para comparação
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const GET = withApiHandler<CorreiosAgenciesResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const uf = searchParams.get('uf');
  const municipio = searchParams.get('municipio') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  if (!uf) {
    throw new ApiError({ code: 'validation_error', message: 'Parâmetro uf é obrigatório', status: 400 });
  }

  const where: {
    uf: string;
    status: 'ATIVA';
    municipio?: { contains: string; mode: 'insensitive' };
  } = {
    uf: uf.toUpperCase(),
    status: 'ATIVA',
  };

  if (municipio) {
    const normalizedMunicipio = removeAccents(municipio).toUpperCase();
    where.municipio = { contains: normalizedMunicipio, mode: 'insensitive' };
  }

  const agencies = await prisma.correiosAgency.findMany({
    where,
    select: {
      id: true,
      nome: true,
      tipoUnidadeSigla: true,
      tipoUnidadeDescricao: true,
      cep: true,
      uf: true,
      municipio: true,
      bairro: true,
      logradouro: true,
      numero: true,
      complemento: true,
      latitude: true,
      longitude: true,
      horarioFuncionamento: true,
      iniExpediente: true,
      fimExpediente: true,
    },
    orderBy: [{ municipio: 'asc' }, { nome: 'asc' }],
    take: limit,
  });

  const formattedAgencies = agencies.map((agency) => ({
    ...agency,
    enderecoCompleto: formatEndereco(agency),
  }));

  return {
    data: {
      agencies: formattedAgencies,
      total: formattedAgencies.length,
      uf,
      municipio: municipio || null,
    },
  };
});

/**
 * Formata endereço completo da agência
 */
function formatEndereco(agency: {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string;
  uf: string;
  cep: string;
}): string {
  const parts: string[] = [];

  if (agency.logradouro) {
    let address = agency.logradouro;
    if (agency.numero) {
      address += `, ${agency.numero}`;
    }
    if (agency.complemento) {
      address += ` - ${agency.complemento}`;
    }
    parts.push(address);
  }

  if (agency.bairro) {
    parts.push(agency.bairro);
  }

  parts.push(`${agency.municipio}/${agency.uf}`);

  if (agency.cep) {
    parts.push(`CEP ${agency.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}`);
  }

  return parts.join(' - ');
}
