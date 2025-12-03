/**
 * POST /api/admin/integrations/correios/test
 *
 * Testa as funcionalidades da integração Correios
 */


import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import {
  getCorreiosConfigAsync,
  validateCorreiosConfig,
  calcularPrazoCorreios,
  cotarCorreiosDefault,
  rastrearObjeto,
  criarPrePostagem,
  getCorreiosConfigInfo,
  testCorreiosAuth,
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

  // Teste de pré-postagem (executa de verdade na API)
  z.object({
    type: z.literal('prepostagem'),
    codigoServico: z.string().min(1, 'Código do serviço é obrigatório'),
    pesoGramas: z.number().min(1).max(30000).default(500),
    alturaCm: z.number().min(1).max(100).optional(),
    larguraCm: z.number().min(1).max(100).optional(),
    comprimentoCm: z.number().min(1).max(100).optional(),
    // Remetente (documento é OBRIGATÓRIO)
    remetenteNome: z.string().min(1, 'Nome do remetente é obrigatório'),
    remetenteDocumento: z.string().min(11, 'CPF/CNPJ do remetente é obrigatório'),
    remetenteCep: z.string().length(8, 'CEP do remetente deve ter 8 dígitos'),
    remetenteLogradouro: z.string().min(1, 'Logradouro do remetente é obrigatório'),
    remetenteNumero: z.string().optional(),
    remetenteBairro: z.string().optional(),
    remetenteCidade: z.string().min(1, 'Cidade do remetente é obrigatória'),
    remetenteUf: z.string().length(2, 'UF do remetente deve ter 2 caracteres'),
    // Destinatário
    destinatarioNome: z.string().min(1, 'Nome do destinatário é obrigatório'),
    destinatarioCep: z.string().length(8, 'CEP do destinatário deve ter 8 dígitos'),
    destinatarioLogradouro: z.string().min(1, 'Logradouro do destinatário é obrigatório'),
    destinatarioNumero: z.string().optional(),
    destinatarioBairro: z.string().optional(),
    destinatarioCidade: z.string().min(1, 'Cidade do destinatário é obrigatória'),
    destinatarioUf: z.string().length(2, 'UF do destinatário deve ter 2 caracteres'),
    // Declaração de Conteúdo (para teste)
    conteudoDescricao: z.string().optional(),
    conteudoValor: z.number().optional(),
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

      case 'prepostagem':
        return await testPrePostagem(data, startTime);

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
async function testAuth(_startTime: number) {
  // Usar nova função que retorna resposta bruta da API
  const authResult = await testCorreiosAuth();
  const configInfo = getCorreiosConfigInfo();

  const authModeLabel = configInfo.authMode === 'apiKey' ? 'API Key (Novo)' : 'Usuário/Senha (Legado)';

  if (authResult.success) {
    return NextResponse.json({
      success: true,
      type: 'auth',
      message: `Autenticação realizada com sucesso (${authModeLabel})`,
      result: {
        tokenObtido: !!authResult.token,
        tokenPreview: authResult.token,
        modoAutenticacao: authModeLabel,
        ambiente: configInfo.environment,
        baseUrl: configInfo.apiBase,
        cartaoPostagem: configInfo.cartaoPostagem,
        httpStatus: authResult.httpStatus,
      },
      // Resposta bruta da API dos Correios
      correiosApiResponse: authResult.rawResponse,
      latencyMs: authResult.latencyMs,
    });
  } else {
    return NextResponse.json({
      success: false,
      type: 'auth',
      message: authResult.error || 'Falha na autenticação',
      result: {
        modoAutenticacao: authModeLabel,
        ambiente: configInfo.environment,
        baseUrl: configInfo.apiBase,
        cartaoPostagem: configInfo.cartaoPostagem,
        httpStatus: authResult.httpStatus,
      },
      // Resposta bruta da API dos Correios (mesmo em erro)
      correiosApiResponse: authResult.rawResponse,
      latencyMs: authResult.latencyMs,
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

    // Extrair respostas brutas da API dos Correios
    const correiosRawResponses = cotacoes.map((c) => ({
      servico: c.codigoServicoCorreios,
      nome: c.nomeServico,
      precoRaw: c.brutoPreco,
      prazoRaw: c.brutoPrazo,
    }));

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
      // Resposta bruta da API dos Correios (preço e prazo)
      correiosApiResponse: correiosRawResponses,
      latencyMs: latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    const configInfo = getCorreiosConfigInfo();
    return NextResponse.json({
      success: false,
      type: 'quote',
      message: error instanceof Error ? error.message : 'Falha na cotação',
      result: {
        ambiente: configInfo.environment,
        baseUrl: configInfo.apiBase,
      },
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
 * Teste de pré-postagem (executa de verdade na API dos Correios)
 */
async function testPrePostagem(
  data: Extract<TestInput, { type: 'prepostagem' }>,
  startTime: number
) {
  try {
    // Garantir que a config do banco está no cache
    await getCorreiosConfigAsync();

    const configInfo = getCorreiosConfigInfo();

    console.log('[CORREIOS_TEST] Executando pré-postagem real:', {
      ambiente: configInfo.environment,
      apiBase: configInfo.apiBase,
      codigoServico: data.codigoServico,
    });

    // Montar input para pré-postagem
    const input = {
      codigoServico: data.codigoServico,
      pesoGramas: data.pesoGramas,
      alturaCm: data.alturaCm,
      larguraCm: data.larguraCm,
      comprimentoCm: data.comprimentoCm,
      remetente: {
        nome: data.remetenteNome,
        documento: data.remetenteDocumento, // CPF/CNPJ obrigatório
        cep: data.remetenteCep,
        logradouro: data.remetenteLogradouro,
        numero: data.remetenteNumero,
        bairro: data.remetenteBairro,
        cidade: data.remetenteCidade,
        uf: data.remetenteUf,
      },
      destinatario: {
        nome: data.destinatarioNome,
        cep: data.destinatarioCep,
        logradouro: data.destinatarioLogradouro,
        numero: data.destinatarioNumero,
        bairro: data.destinatarioBairro,
        cidade: data.destinatarioCidade,
        uf: data.destinatarioUf,
      },
      // Declaração de conteúdo (obrigatório se não tiver NF-e)
      itensDeclaracaoConteudo: [{
        conteudo: data.conteudoDescricao || 'Mercadoria para teste',
        quantidade: 1,
        valor: data.conteudoValor || 50,
      }],
    };

    // Executar pré-postagem real na API dos Correios
    const resultado = await criarPrePostagem(input);
    const latency = Date.now() - startTime;

    if (resultado.success) {
      return NextResponse.json({
        success: true,
        type: 'prepostagem',
        message: `Pré-postagem criada com sucesso! Código de rastreio: ${resultado.codigoRastreio || 'Aguardando processamento'}`,
        result: {
          ambiente: configInfo.environment,
          apiBase: configInfo.apiBase,
          idLote: resultado.idLote,
          codigoRastreio: resultado.codigoRastreio,
          idObjeto: resultado.idObjeto,
          status: resultado.status,
          dadosEnviados: input,
          respostaCompleta: resultado.bruto,
        },
        latencyMs: latency,
      });
    } else {
      return NextResponse.json({
        success: false,
        type: 'prepostagem',
        message: resultado.erros?.[0]?.mensagem || 'Erro ao criar pré-postagem',
        result: {
          ambiente: configInfo.environment,
          apiBase: configInfo.apiBase,
          erros: resultado.erros,
          dadosEnviados: input,
          respostaCompleta: resultado.bruto,
        },
        latencyMs: latency,
      });
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    const configInfo = getCorreiosConfigInfo();

    console.error('[CORREIOS_TEST] Erro na pré-postagem:', error);

    return NextResponse.json({
      success: false,
      type: 'prepostagem',
      message: error instanceof Error ? error.message : 'Falha na pré-postagem',
      result: {
        ambiente: configInfo.environment,
        apiBase: configInfo.apiBase,
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      latencyMs: latency,
    });
  }
}
