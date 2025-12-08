/**
 * Módulo de Preço e Prazo dos Correios
 *
 * Responsabilidades:
 * - Calcular preço de frete para múltiplos serviços
 * - Calcular prazo de entrega para múltiplos serviços
 * - Combinar preço + prazo em cotação completa
 *
 * APIs utilizadas:
 * - POST /preco/v1/nacional (até 5 simulações por requisição)
 * - POST /prazo/v1/nacional (até 5 simulações por requisição)
 */

import { correiosFetch, parseCorreiosDecimal } from './client';
import {
  type CorreiosPrecoPrazoInput,
  type CorreiosPrecoOutput,
  type CorreiosPrazoOutput,
  type CorreiosCotacaoCompleta,
  type CorreiosPrecoRequest,
  type CorreiosPrecoResponse,
  type CorreiosPrazoRequest,
  type CorreiosPrazoResponse,
  type CorreiosServiceConfig,
  CorreiosApiError,
  CorreiosValidationError,
} from './types';
import {
  CORREIOS_ENDPOINTS,
  TIPO_OBJETO,
  SERVICO_ADICIONAL,
  CORREIOS_LIMITS,
  DEFAULT_CORREIOS_SERVICES,
  servicoAceitaValorDeclarado,
} from './constants';

// ============================================================================
// Validação
// ============================================================================

/**
 * Normaliza CEP removendo caracteres não numéricos
 */
function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Valida dados de entrada para cotação
 */
function validateInput(input: CorreiosPrecoPrazoInput): void {
  const cepOrigem = normalizeCep(input.cepOrigem);
  const cepDestino = normalizeCep(input.cepDestino);

  if (cepOrigem.length !== 8) {
    throw new CorreiosValidationError('CEP de origem inválido');
  }

  if (cepDestino.length !== 8) {
    throw new CorreiosValidationError('CEP de destino inválido');
  }

  if (input.pesoGramas <= 0) {
    throw new CorreiosValidationError('Peso deve ser maior que zero');
  }

  if (input.pesoGramas > CORREIOS_LIMITS.PESO_MAX_PAC * 1000) {
    throw new CorreiosValidationError(
      `Peso excede o limite máximo de ${CORREIOS_LIMITS.PESO_MAX_PAC}kg`
    );
  }

  // Validar dimensões
  const somaDimensoes = input.comprimentoCm + input.larguraCm + input.alturaCm;
  if (somaDimensoes > CORREIOS_LIMITS.SOMA_DIMENSOES_MAX) {
    throw new CorreiosValidationError(
      `Soma das dimensões (${somaDimensoes}cm) excede o limite de ${CORREIOS_LIMITS.SOMA_DIMENSOES_MAX}cm`
    );
  }
}

/**
 * Determina o tipo de objeto baseado nas dimensões
 */
function determineTipoObjeto(
  comprimento: number,
  largura: number,
  altura: number
): number {
  // Se altura for muito pequena, pode ser envelope
  if (altura <= 2 && comprimento <= 60 && largura <= 60) {
    return TIPO_OBJETO.ENVELOPE;
  }

  // Se uma dimensão for muito maior que as outras, pode ser rolo/prisma
  const maxDim = Math.max(comprimento, largura, altura);
  const minDim = Math.min(comprimento, largura, altura);
  if (maxDim / minDim > 5) {
    return TIPO_OBJETO.ROLO_PRISMA;
  }

  // Padrão: caixa/pacote
  return TIPO_OBJETO.CAIXA_PACOTE;
}

// ============================================================================
// API de Preço
// ============================================================================

/**
 * Calcula preço de frete para múltiplos serviços
 *
 * @param servicos Array de códigos de serviço (ex: ["03220", "03298"])
 * @param input Dados do objeto (CEPs, peso, dimensões)
 * @returns Array com preço para cada serviço
 */
export async function calcularPrecoCorreios(
  servicos: string[],
  input: CorreiosPrecoPrazoInput
): Promise<CorreiosPrecoOutput[]> {
  if (servicos.length === 0) {
    return [];
  }

  validateInput(input);

  const cepOrigem = normalizeCep(input.cepOrigem);
  const cepDestino = normalizeCep(input.cepDestino);
  const tpObjeto = determineTipoObjeto(
    input.comprimentoCm,
    input.larguraCm,
    input.alturaCm
  );

  // Montar serviços adicionais BASE (sem valor declarado)
  const servicosAdicionaisBase: Array<{
    coServAdicional: string;
    vlDeclarado?: number;
  }> = [];

  if (input.servicosAdicionais) {
    for (const codigo of input.servicosAdicionais) {
      // Não adicionar VD aqui - será tratado separadamente
      if (codigo !== SERVICO_ADICIONAL.VALOR_DECLARADO) {
        servicosAdicionaisBase.push({ coServAdicional: codigo });
      }
    }
  }

  // Verificar se há valor declarado válido
  const temValorDeclarado = input.valorDeclarado && input.valorDeclarado > 0;

  // Validar valor mínimo/máximo para valor declarado
  if (temValorDeclarado) {
    if (input.valorDeclarado! < CORREIOS_LIMITS.VALOR_DECLARADO_MIN) {
      console.warn('[CORREIOS_PRECO] Valor declarado abaixo do mínimo:', {
        informado: input.valorDeclarado,
        minimo: CORREIOS_LIMITS.VALOR_DECLARADO_MIN,
      });
    }
    if (input.valorDeclarado! > CORREIOS_LIMITS.VALOR_DECLARADO_MAX) {
      console.warn('[CORREIOS_PRECO] Valor declarado acima do máximo:', {
        informado: input.valorDeclarado,
        maximo: CORREIOS_LIMITS.VALOR_DECLARADO_MAX,
      });
    }
  }

  // Separar serviços por compatibilidade com valor declarado
  const servicosComVD: string[] = [];
  const servicosSemVD: string[] = [];

  for (const codigo of servicos) {
    if (temValorDeclarado && servicoAceitaValorDeclarado(codigo)) {
      servicosComVD.push(codigo);
    } else {
      servicosSemVD.push(codigo);
    }
  }

  console.log('[CORREIOS_PRECO] Serviços separados:', {
    comValorDeclarado: servicosComVD,
    semValorDeclarado: servicosSemVD,
    valorDeclarado: input.valorDeclarado,
  });

  const results: CorreiosPrecoOutput[] = [];

  // Função auxiliar para fazer requisição de preço
  const fetchPrecoBatch = async (
    batch: string[],
    incluirVD: boolean,
    batchIndex: number
  ): Promise<void> => {
    // Montar serviços adicionais para este batch
    const servicosAdicionais = [...servicosAdicionaisBase];

    if (incluirVD && temValorDeclarado && input.valorDeclarado! >= CORREIOS_LIMITS.VALOR_DECLARADO_MIN) {
      servicosAdicionais.push({
        coServAdicional: SERVICO_ADICIONAL.VALOR_DECLARADO,
        vlDeclarado: input.valorDeclarado,
      });
    }

    const request: CorreiosPrecoRequest = {
      idLote: `preco_${Date.now()}_${batchIndex}`,
      parametrosProduto: batch.map((codigo, idx) => ({
        coProduto: codigo,
        nuRequisicao: `req_${idx}`,
        cepOrigem,
        cepDestino,
        psObjeto: Math.round(input.pesoGramas),
        tpObjeto,
        comprimento: Math.round(input.comprimentoCm),
        largura: Math.round(input.larguraCm),
        altura: Math.round(input.alturaCm),
        servicosAdicionais: servicosAdicionais.length > 0 ? servicosAdicionais : undefined,
        // Só enviar vlDeclarado se o batch inclui VD E o valor é válido
        vlDeclarado: incluirVD && input.valorDeclarado! >= CORREIOS_LIMITS.VALOR_DECLARADO_MIN
          ? input.valorDeclarado
          : undefined,
      })),
    };

    console.log('[CORREIOS_PRECO] Requesting prices:', {
      servicos: batch,
      incluirVD,
      cepOrigem,
      cepDestino,
      pesoGramas: input.pesoGramas,
      valorDeclarado: incluirVD ? input.valorDeclarado : 'N/A (serviço não aceita)',
      servicosAdicionais: servicosAdicionais.length > 0 ? servicosAdicionais : 'none',
    });

    try {
      const rawResponse = await correiosFetch<CorreiosPrecoResponse | Array<Record<string, unknown>>>(
        CORREIOS_ENDPOINTS.precoNacional,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('[CORREIOS_PRECO] Raw response type:', Array.isArray(rawResponse) ? 'Array' : 'Object');
      console.log('[CORREIOS_PRECO] Raw response:', JSON.stringify(rawResponse, null, 2).slice(0, 2000));

      // A API pode retornar array direto ou objeto com parametrosProduto
      let responseItems: Array<Record<string, unknown>>;
      if (Array.isArray(rawResponse)) {
        responseItems = rawResponse;
      } else {
        responseItems = (rawResponse as CorreiosPrecoResponse).parametrosProduto || [];
      }

      // Processar cada resultado
      for (const item of responseItems) {
        const output: CorreiosPrecoOutput = {
          codigoServicoCorreios: item.coProduto as string,
          precoTotal: parseCorreiosDecimal(item.pcFinal as string),
          precoBase: parseCorreiosDecimal(item.pcBase as string),
          precoServicosAdicionais: parseCorreiosDecimal(item.pcTotalServicosAdicionais as string),
          bruto: item,
        };

        console.log('[CORREIOS_PRECO] Parsed item:', {
          codigo: output.codigoServicoCorreios,
          precoTotal: output.precoTotal,
          rawPcFinal: item.pcFinal,
        });

        // Verificar erros
        const txErro = item.txErro as Array<{ cdErro: string; dsErro: string }> | undefined;
        if (txErro && txErro.length > 0) {
          output.erros = txErro.map((e) => ({
            codigo: e.cdErro,
            mensagem: e.dsErro,
          }));

          console.warn('[CORREIOS_PRECO] Service error:', {
            servico: item.coProduto,
            erros: output.erros,
          });
        }

        results.push(output);
      }
    } catch (error) {
      console.error('[CORREIOS_PRECO] Batch failed:', {
        batch,
        incluirVD,
        error: error instanceof Error ? error.message : error,
      });

      // Adicionar resultado de erro para cada serviço do lote
      for (const codigo of batch) {
        results.push({
          codigoServicoCorreios: codigo,
          precoTotal: 0,
          erros: [{
            codigo: 'API_ERROR',
            mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
          }],
          bruto: null,
        });
      }
    }
  };

  // Processar serviços SEM valor declarado (ex: PAC)
  let batchIndex = 0;
  for (let i = 0; i < servicosSemVD.length; i += CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRECO) {
    const batch = servicosSemVD.slice(i, i + CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRECO);
    await fetchPrecoBatch(batch, false, batchIndex++);
  }

  // Processar serviços COM valor declarado (ex: SEDEX)
  for (let i = 0; i < servicosComVD.length; i += CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRECO) {
    const batch = servicosComVD.slice(i, i + CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRECO);
    await fetchPrecoBatch(batch, true, batchIndex++);
  }

  return results;
}

// ============================================================================
// API de Prazo
// ============================================================================

/**
 * Calcula prazo de entrega para múltiplos serviços
 *
 * @param servicos Array de códigos de serviço
 * @param input Dados (CEPs)
 * @returns Array com prazo para cada serviço
 */
export async function calcularPrazoCorreios(
  servicos: string[],
  input: CorreiosPrecoPrazoInput
): Promise<CorreiosPrazoOutput[]> {
  if (servicos.length === 0) {
    return [];
  }

  const cepOrigem = normalizeCep(input.cepOrigem);
  const cepDestino = normalizeCep(input.cepDestino);

  const results: CorreiosPrazoOutput[] = [];

  // Dividir em lotes de até 5 (limite da API)
  for (let i = 0; i < servicos.length; i += CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRAZO) {
    const batch = servicos.slice(i, i + CORREIOS_LIMITS.MAX_OBJETOS_POR_LOTE_PRAZO);

    const request: CorreiosPrazoRequest = {
      idLote: `prazo_${Date.now()}_${i}`,
      parametrosPrazo: batch.map((codigo, idx) => ({
        coProduto: codigo,
        nuRequisicao: `req_${idx}`,
        cepOrigem,
        cepDestino,
      })),
    };

    console.log('[CORREIOS_PRAZO] Requesting deadlines:', {
      servicos: batch,
      cepOrigem,
      cepDestino,
    });

    try {
      const rawResponse = await correiosFetch<CorreiosPrazoResponse | Array<Record<string, unknown>>>(
        CORREIOS_ENDPOINTS.prazoNacional,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      console.log('[CORREIOS_PRAZO] Raw response type:', Array.isArray(rawResponse) ? 'Array' : 'Object');

      // A API pode retornar array direto ou objeto com parametrosPrazo
      let responseItems: Array<Record<string, unknown>>;
      if (Array.isArray(rawResponse)) {
        responseItems = rawResponse;
      } else {
        responseItems = (rawResponse as CorreiosPrazoResponse).parametrosPrazo || [];
      }

      // Processar cada resultado
      for (const item of responseItems) {
        const output: CorreiosPrazoOutput = {
          codigoServicoCorreios: item.coProduto as string,
          prazoDias: (item.prazoEntrega as number) || 0,
          dataMaxima: item.dataMaxima as string,
          entregaDomiciliar: item.entregaDomiciliar === 'S',
          entregaSabado: item.entregaSabado === 'S',
          bruto: item,
        };

        console.log('[CORREIOS_PRAZO] Parsed item:', {
          codigo: output.codigoServicoCorreios,
          prazoDias: output.prazoDias,
          rawPrazoEntrega: item.prazoEntrega,
        });

        // Verificar erros
        const txErro = item.txErro as Array<{ cdErro: string; dsErro: string }> | undefined;
        if (txErro && txErro.length > 0) {
          output.erros = txErro.map((e) => ({
            codigo: e.cdErro,
            mensagem: e.dsErro,
          }));

          console.warn('[CORREIOS_PRAZO] Service error:', {
            servico: item.coProduto,
            erros: output.erros,
          });
        }

        results.push(output);
      }
    } catch (error) {
      console.error('[CORREIOS_PRAZO] Batch failed:', {
        batch,
        error: error instanceof Error ? error.message : error,
      });

      // Adicionar resultado de erro para cada serviço do lote
      for (const codigo of batch) {
        results.push({
          codigoServicoCorreios: codigo,
          prazoDias: 0,
          entregaDomiciliar: false,
          entregaSabado: false,
          erros: [{
            codigo: 'API_ERROR',
            mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
          }],
          bruto: null,
        });
      }
    }
  }

  return results;
}

// ============================================================================
// Cotação Completa (Preço + Prazo)
// ============================================================================

/**
 * Obtém a configuração de serviços dos Correios
 * Por enquanto, usa configuração padrão.
 * TODO: Buscar do banco de dados por remetente/contrato
 */
export function getCorreiosServicos(): CorreiosServiceConfig[] {
  // Tentar carregar do env (JSON) se disponível
  const envServicos = process.env.CORREIOS_SERVICOS;
  if (envServicos) {
    try {
      const parsed = JSON.parse(envServicos) as CorreiosServiceConfig[];
      return parsed.filter((s) => s.habilitado);
    } catch (error) {
      console.warn('[CORREIOS] Failed to parse CORREIOS_SERVICOS env:', error);
    }
  }

  // Retornar serviços padrão habilitados
  return DEFAULT_CORREIOS_SERVICES.filter((s) => s.habilitado);
}

/**
 * Calcula cotação completa (preço + prazo) para todos os serviços habilitados
 *
 * @param servicos Array de configurações de serviço (ou usar default)
 * @param input Dados do objeto
 * @returns Array com cotação completa para cada serviço
 */
export async function cotarCorreios(
  servicos: CorreiosServiceConfig[],
  input: CorreiosPrecoPrazoInput
): Promise<CorreiosCotacaoCompleta[]> {
  if (servicos.length === 0) {
    console.warn('[CORREIOS_COTAR] No services configured');
    return [];
  }

  const codigosServico = servicos.map((s) => s.codigoServico);

  console.log('[CORREIOS_COTAR] Starting quote:', {
    servicos: servicos.map((s) => ({ codigo: s.codigoServico, nome: s.nomeExibicao })),
    cepOrigem: input.cepOrigem,
    cepDestino: input.cepDestino,
    pesoGramas: input.pesoGramas,
  });

  // Chamar APIs de preço e prazo em paralelo
  const [precoResults, prazoResults] = await Promise.all([
    calcularPrecoCorreios(codigosServico, input),
    calcularPrazoCorreios(codigosServico, input),
  ]);

  // Criar mapa para lookup rápido
  const precoMap = new Map(precoResults.map((r) => [r.codigoServicoCorreios, r]));
  const prazoMap = new Map(prazoResults.map((r) => [r.codigoServicoCorreios, r]));
  const servicoMap = new Map(servicos.map((s) => [s.codigoServico, s]));

  // Combinar resultados
  const cotacoes: CorreiosCotacaoCompleta[] = [];

  for (const codigo of codigosServico) {
    const preco = precoMap.get(codigo);
    const prazo = prazoMap.get(codigo);
    const servicoConfig = servicoMap.get(codigo);

    // Ignorar se não tiver configuração
    if (!servicoConfig) continue;

    // Verificar se tem erros críticos
    const erros: Array<{ codigo: string; mensagem: string }> = [];
    if (preco?.erros) erros.push(...preco.erros);
    if (prazo?.erros) erros.push(...prazo.erros);

    // Se não tem preço válido, incluir com erros para diagnóstico
    if (!preco || preco.precoTotal <= 0) {
      console.warn('[CORREIOS_COTAR] Service has no price:', {
        servico: codigo,
        nome: servicoConfig.nomeExibicao,
        erros,
      });

      // Incluir serviço com erro para fins de diagnóstico
      cotacoes.push({
        codigoServicoCorreios: codigo,
        nomeServico: servicoConfig.nomeExibicao,
        precoTotal: 0,
        prazoDias: prazo?.prazoDias || 0,
        entregaDomiciliar: false,
        entregaSabado: false,
        erros: erros.length > 0 ? erros : [{ codigo: 'NO_PRICE', mensagem: 'Serviço não retornou preço' }],
        brutoPreco: preco?.bruto || null,
        brutoPrazo: prazo?.bruto || null,
      });
      continue;
    }

    // Se não tem prazo, usar valor default
    const prazoDias = prazo?.prazoDias || 0;

    const cotacao: CorreiosCotacaoCompleta = {
      codigoServicoCorreios: codigo,
      nomeServico: servicoConfig.nomeExibicao,
      precoTotal: preco.precoTotal,
      prazoDias,
      entregaDomiciliar: prazo?.entregaDomiciliar ?? true,
      entregaSabado: prazo?.entregaSabado ?? false,
      erros: erros.length > 0 ? erros : undefined,
      brutoPreco: preco.bruto,
      brutoPrazo: prazo?.bruto,
    };

    cotacoes.push(cotacao);
  }

  console.log('[CORREIOS_COTAR] Quote completed:', {
    total: cotacoes.length,
    servicos: cotacoes.map((c) => ({
      nome: c.nomeServico,
      preco: c.precoTotal,
      prazo: c.prazoDias,
    })),
  });

  return cotacoes;
}

/**
 * Cotação simplificada usando serviços padrão habilitados
 */
export async function cotarCorreiosDefault(
  input: CorreiosPrecoPrazoInput
): Promise<CorreiosCotacaoCompleta[]> {
  const servicos = getCorreiosServicos();
  return cotarCorreios(servicos, input);
}

// ============================================================================
// Cotação Multi-Volume
// ============================================================================

import type {
  CorreiosVolumeQuoteInput,
  CorreiosVolumeQuoteResult,
  CorreiosMultiVolumeQuoteResult,
} from './types';

/**
 * Cotação multi-volume para Correios
 *
 * Para embarques com múltiplos volumes, cada volume deve ser cotado
 * individualmente pois os Correios cobram por pacote.
 *
 * @param cepOrigem CEP de origem
 * @param cepDestino CEP de destino
 * @param volumes Array de volumes com dimensões e peso individuais
 * @param valorDeclarado Valor declarado total (rateado entre volumes)
 * @returns Cotação consolidada por serviço com soma dos preços
 */
export async function cotarMultiVolumeCorreios(
  cepOrigem: string,
  cepDestino: string,
  volumes: CorreiosVolumeQuoteInput[],
  valorDeclarado?: number
): Promise<CorreiosMultiVolumeQuoteResult[]> {
  if (volumes.length === 0) {
    console.warn('[CORREIOS_MULTI_VOLUME] No volumes provided');
    return [];
  }

  console.log('[CORREIOS_MULTI_VOLUME] Starting quote:', {
    cepOrigem,
    cepDestino,
    totalVolumes: volumes.length,
    volumes: volumes.map((v) => ({
      packageNumber: v.packageNumber,
      weight: v.weight,
      dimensions: `${v.width}x${v.height}x${v.length}`,
    })),
  });

  const servicos = getCorreiosServicos();
  if (servicos.length === 0) {
    console.warn('[CORREIOS_MULTI_VOLUME] No services configured');
    return [];
  }

  // Valor declarado rateado por volume (proporcional ao peso ou igualmente)
  const valorPorVolume = valorDeclarado
    ? valorDeclarado / volumes.length
    : undefined;

  // Cotar cada volume individualmente
  const volumeQuotes: Map<number, CorreiosCotacaoCompleta[]> = new Map();

  for (const volume of volumes) {
    const input: CorreiosPrecoPrazoInput = {
      cepOrigem,
      cepDestino,
      pesoGramas: Math.round(volume.weight * 1000), // kg -> gramas
      comprimentoCm: Math.round(volume.length),
      larguraCm: Math.round(volume.width),
      alturaCm: Math.round(volume.height),
      valorDeclarado: valorPorVolume,
    };

    const quotes = await cotarCorreios(servicos, input);
    volumeQuotes.set(volume.packageNumber, quotes);

    console.log('[CORREIOS_MULTI_VOLUME] Volume quoted:', {
      packageNumber: volume.packageNumber,
      quotesCount: quotes.length,
      prices: quotes.map((q) => ({ service: q.nomeServico, price: q.precoTotal })),
    });
  }

  // Consolidar resultados por serviço
  const consolidatedResults: CorreiosMultiVolumeQuoteResult[] = [];

  for (const servico of servicos) {
    const volumeResults: CorreiosVolumeQuoteResult[] = [];
    let totalPrice = 0;
    let hasErrors = false;
    let deliveryDays = 0;

    for (const volume of volumes) {
      const quotes = volumeQuotes.get(volume.packageNumber) || [];
      const quote = quotes.find(
        (q) => q.codigoServicoCorreios === servico.codigoServico
      );

      if (quote) {
        const volumeResult: CorreiosVolumeQuoteResult = {
          packageNumber: volume.packageNumber,
          serviceCode: servico.codigoServico,
          serviceName: servico.nomeExibicao,
          price: quote.precoTotal,
          deliveryDays: quote.prazoDias,
        };

        if (quote.erros && quote.erros.length > 0) {
          volumeResult.error = quote.erros.map((e) => e.mensagem).join('; ');
          hasErrors = true;
        }

        volumeResults.push(volumeResult);
        totalPrice += quote.precoTotal;

        // Prazo é o mesmo para todos os volumes (usar o maior se houver diferença)
        if (quote.prazoDias > deliveryDays) {
          deliveryDays = quote.prazoDias;
        }
      } else {
        // Volume sem cotação
        volumeResults.push({
          packageNumber: volume.packageNumber,
          serviceCode: servico.codigoServico,
          serviceName: servico.nomeExibicao,
          price: 0,
          deliveryDays: 0,
          error: 'Cotação não disponível para este volume',
        });
        hasErrors = true;
      }
    }

    // Só incluir se tiver preço válido para todos os volumes (ou parcialmente)
    if (totalPrice > 0 || volumeResults.some((v) => v.price > 0)) {
      consolidatedResults.push({
        serviceCode: servico.codigoServico,
        serviceName: servico.nomeExibicao,
        totalPrice,
        deliveryDays,
        volumeResults,
        hasErrors,
      });
    }
  }

  console.log('[CORREIOS_MULTI_VOLUME] Quote completed:', {
    servicesQuoted: consolidatedResults.length,
    results: consolidatedResults.map((r) => ({
      service: r.serviceName,
      totalPrice: r.totalPrice,
      deliveryDays: r.deliveryDays,
      volumes: r.volumeResults.length,
      hasErrors: r.hasErrors,
    })),
  });

  return consolidatedResults;
}
