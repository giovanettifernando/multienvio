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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

/**
 * Remove acentos de uma string para comparação
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação do usuário
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros de query
    const { searchParams } = new URL(request.url);
    const uf = searchParams.get('uf');
    const municipio = searchParams.get('municipio') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    if (!uf) {
      return NextResponse.json(
        { error: 'Parâmetro uf é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar agências ativas (todas as agências ativas aceitam postagem)
    const where: {
      uf: string;
      status: 'ATIVA';
      municipio?: { contains: string; mode: 'insensitive' };
    } = {
      uf: uf.toUpperCase(),
      status: 'ATIVA',
    };

    if (municipio) {
      // Normalizar município removendo acentos para comparação
      // Ex: "João Pessoa" -> "JOAO PESSOA"
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

    // Formatar endereço completo
    const formattedAgencies = agencies.map((agency) => ({
      ...agency,
      enderecoCompleto: formatEndereco(agency),
    }));

    return NextResponse.json({
      agencies: formattedAgencies,
      total: formattedAgencies.length,
      uf,
      municipio: municipio || null,
    });
  } catch (error) {
    console.error('[CORREIOS_AGENCIES_NEARBY] Erro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

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
