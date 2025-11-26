/**
 * POST /api/admin/integrations/correios/test
 *
 * Testa as funcionalidades da integração Correios
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import {
  getCorreiosToken,
  getCorreiosConfigAsync,
  validateCorreiosConfig,
  calcularPrecoCorreios,
  calcularPrazoCorreios,
  cotarCorreiosDefault,
  rastrearObjeto,
  criarPrePostagem,
  getCorreiosConfigInfo,
} from '@/lib/integrations/correios';

/**
 * Schema para testes
 */
const testSchema = z.discriminatedUnion('type', [
  // Teste de conexão/autenticação
  z.object({
    type: z.literal('auth'),
  }),

  // Teste de cotação
  z.object({
    type: z.literal('quote'),
    cepOrigem: z.string().length(8, 'CEP origem deve ter 8 dígitos'),
    cepDestino: z.string().length(8, 'CEP destino deve ter 8 dígitos'),
    pesoGramas: z.number().min(1).max(30000).default(500),
    comprimentoCm: z.number().min(1).max(100).default(20),
    larguraCm: z.number().min(1).max(100).default(15),
    alturaCm: z.number().min(1).max(100).default(10),
    valorDeclarado: z.number().optional(),
  }),

  // Teste de prazo
  z.object({
    type: z.literal('deadline'),
    cepOrigem: z.string().length(8, 'CEP origem deve ter 8 dígitos'),
    cepDestino: z.string().length(8, 'CEP destino deve ter 8 dígitos'),
    codigoServico: z.string().min(1, 'Código do serviço é obrigatório'),
  }),

  // Teste de rastreamento
  z.object({
    type: z.literal('tracking'),
    codigoRastreio: z
      .string()
      .regex(/^[A-Z]{2}\d{9}[A-Z]{2}$/, 'Código de rastreio inválido (ex: NX000000000BR)'),
  }),

  // Teste de pré-postagem (simulação)
  z.object({
    type: z.literal('prepostagem_sim'),
    codigoServico: z.string().min(1, 'Código do serviço é obrigatório'),
    cepOrigem: z.string().length(8, 'CEP origem deve ter 8 dígitos'),
    cepDestino: z.string().length(8, 'CEP destino deve ter 8 dígitos'),
    pesoGramas: z.number().min(1).max(30000).default(500),
  }),
]);

type TestInput = z.infer<typeof testSchema>;

/**
 * POST - Executa teste da integração
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Validar payload
    const body = await request.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: TestInput = parsed.data;

    // Carregar configuração do banco (prioridade) ou env vars
    const config = await getCorreiosConfigAsync();
    const validation = validateCorreiosConfig(config);

    // Verificar se integração está configurada
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Integração dos Correios não está configurada',
          hint: 'Configure as credenciais antes de executar testes',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    switch (data.type) {
      case 'auth':
        return await testAuth(startTime);

      case 'quote':
        return await testQuote(data, startTime);

      case 'deadline':
        return await testDeadline(data, startTime);

      case 'tracking':
        return await testTracking(data, startTime);

      case 'prepostagem_sim':
        return await testPrePostagemSimulation(data, startTime);

      default:
        return NextResponse.json(
          { success: false, message: 'Tipo de teste não suportado' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ADMIN_CORREIOS_TEST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao executar teste';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * Teste de autenticação
 */
async function testAuth(startTime: number) {
  try {
    const configInfo = getCorreiosConfigInfo();
    const token = await getCorreiosToken();
    const latency = Date.now() - startTime;

    const authModeLabel = configInfo.authMode === 'apiKey' ? 'API Key (Novo)' : 'Usuário/Senha (Legado)';

    return NextResponse.json({
      success: true,
      type: 'auth',
      message: `Autenticação realizada com sucesso (${authModeLabel})`,
      result: {
        tokenObtido: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : null,
        modoAutenticacao: authModeLabel,
        ambiente: configInfo.environment,
        baseUrl: configInfo.apiBase,
        cartaoPostagem: configInfo.cartaoPostagem,
      },
      latencyMs: latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      type: 'auth',
      message: error instanceof Error ? error.message : 'Falha na autenticação',
      latencyMs: latency,
    });
  }
}

/**
 * Teste de cotação
 */
async function testQuote(
  data: Extract<TestInput, { type: 'quote' }>,
  startTime: number
) {
  try {
    // Garantir que a config do banco está no cache antes de cotar
    // (correiosFetch usa getCorreiosConfig() síncrona que depende do cache)
    await getCorreiosConfigAsync();

    const cotacoes = await cotarCorreiosDefault({
      cepOrigem: data.cepOrigem,
      cepDestino: data.cepDestino,
      pesoGramas: data.pesoGramas,
      comprimentoCm: data.comprimentoCm,
      larguraCm: data.larguraCm,
      alturaCm: data.alturaCm,
      valorDeclarado: data.valorDeclarado,
    });
    const latency = Date.now() - startTime;

    const servicosEncontrados = cotacoes.filter((c) => c.precoTotal > 0);

    return NextResponse.json({
      success: true,
      type: 'quote',
      message: `Cotação realizada com sucesso. ${servicosEncontrados.length} serviço(s) disponível(is).`,
      result: {
        input: {
          cepOrigem: data.cepOrigem,
          cepDestino: data.cepDestino,
          pesoGramas: data.pesoGramas,
          dimensoes: `${data.comprimentoCm}x${data.larguraCm}x${data.alturaCm} cm`,
        },
        servicos: cotacoes.map((c) => ({
          codigo: c.codigoServicoCorreios,
          nome: c.nomeServico,
          preco: c.precoTotal,
          prazo: c.prazoDias,
          entregaDomiciliar: c.entregaDomiciliar,
          entregaSabado: c.entregaSabado,
          erros: c.erros,
        })),
        totalServicos: cotacoes.length,
        servicosDisponiveis: servicosEncontrados.length,
      },
      latencyMs: latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      type: 'quote',
      message: error instanceof Error ? error.message : 'Falha na cotação',
      latencyMs: latency,
    });
  }
}

/**
 * Teste de prazo
 */
async function testDeadline(
  data: Extract<TestInput, { type: 'deadline' }>,
  startTime: number
) {
  try {
    const prazos = await calcularPrazoCorreios([data.codigoServico], {
      cepOrigem: data.cepOrigem,
      cepDestino: data.cepDestino,
      pesoGramas: 500,
      comprimentoCm: 20,
      larguraCm: 15,
      alturaCm: 10,
    });
    const latency = Date.now() - startTime;

    const prazo = prazos[0];

    return NextResponse.json({
      success: true,
      type: 'deadline',
      message: prazo
        ? `Prazo calculado: ${prazo.prazoDias} dia(s) úteis`
        : 'Nenhum prazo retornado',
      result: {
        input: {
          cepOrigem: data.cepOrigem,
          cepDestino: data.cepDestino,
          codigoServico: data.codigoServico,
        },
        prazo: prazo
          ? {
              codigo: prazo.codigoServicoCorreios,
              prazoDias: prazo.prazoDias,
              dataMaxima: prazo.dataMaxima,
              entregaDomiciliar: prazo.entregaDomiciliar,
              entregaSabado: prazo.entregaSabado,
              erros: prazo.erros,
            }
          : null,
      },
      latencyMs: latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      type: 'deadline',
      message: error instanceof Error ? error.message : 'Falha no cálculo de prazo',
      latencyMs: latency,
    });
  }
}

/**
 * Teste de rastreamento
 */
async function testTracking(
  data: Extract<TestInput, { type: 'tracking' }>,
  startTime: number
) {
  try {
    const resultado = await rastrearObjeto(data.codigoRastreio);
    const latency = Date.now() - startTime;

    const hasEvents = resultado.eventos && resultado.eventos.length > 0;

    return NextResponse.json({
      success: hasEvents,
      type: 'tracking',
      message: hasEvents
        ? `Rastreamento encontrado: ${resultado.eventos.length} evento(s)`
        : resultado.mensagem || 'Objeto não encontrado',
      result: {
        codigo: data.codigoRastreio,
        encontrado: hasEvents,
        entregue: resultado.entregue,
        ultimoStatus: resultado.ultimoStatus,
        eventos: resultado.eventos.slice(0, 5).map((e) => ({
          dataHora: e.dataHora,
          descricao: e.descricao,
          local: e.local,
          cidade: e.cidade,
          uf: e.uf,
        })),
        totalEventos: resultado.eventos.length,
      },
      latencyMs: latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      type: 'tracking',
      message: error instanceof Error ? error.message : 'Falha no rastreamento',
      latencyMs: latency,
    });
  }
}

/**
 * Teste de pré-postagem (simulação - não cria objeto real)
 */
async function testPrePostagemSimulation(
  data: Extract<TestInput, { type: 'prepostagem_sim' }>,
  startTime: number
) {
  const latency = Date.now() - startTime;

  // Para não criar objetos reais na API, apenas validamos os dados
  // e retornamos uma simulação do que seria enviado
  const payload = {
    idCorreios: `SIM-${Date.now()}`,
    codigoServico: data.codigoServico,
    cepOrigem: data.cepOrigem,
    cepDestino: data.cepDestino,
    pesoGramas: data.pesoGramas,
    remetente: {
      nome: 'Remetente Teste',
      cep: data.cepOrigem,
    },
    destinatario: {
      nome: 'Destinatário Teste',
      cep: data.cepDestino,
      logradouro: 'Rua de Teste',
      cidade: 'Cidade Teste',
      uf: 'SP',
    },
  };

  return NextResponse.json({
    success: true,
    type: 'prepostagem_sim',
    message:
      'Simulação de pré-postagem. Os dados estão válidos para envio à API.',
    result: {
      simulacao: true,
      avisoImportante:
        'Este é um teste de simulação. Nenhum objeto foi criado na API dos Correios.',
      payloadQueSeriaEnviado: payload,
      endpointDestino: '/prepostagem/v2/prepostagens',
    },
    latencyMs: latency,
  });
}
