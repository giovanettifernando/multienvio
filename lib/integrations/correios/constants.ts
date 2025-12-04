/**
 * Constantes para integração com APIs dos Correios
 *
 * IMPORTANTE: Os códigos de serviço podem variar conforme o contrato.
 * Os valores aqui são exemplos comuns. Consulte seu contrato para
 * obter os códigos corretos.
 */

// ============================================================================
// URLs Base
// ============================================================================

export const CORREIOS_API_BASE = {
  sandbox: 'https://apihom.correios.com.br',
  production: 'https://api.correios.com.br',
} as const;

// ============================================================================
// Endpoints
// ============================================================================

export const CORREIOS_ENDPOINTS = {
  // Autenticação
  token: '/token/v1/autentica/cartaopostagem',

  // Preço
  precoNacional: '/preco/v1/nacional',          // POST para múltiplos, GET /{codigoServico} para um

  // Prazo
  prazoNacional: '/prazo/v1/nacional',          // POST para múltiplos, GET /{coProduto} para um

  // Pré-Postagem Nacional (PPN) - API 36
  // Documentação oficial CWS - seção 5.3
  // IMPORTANTE: Todos os endpoints de pré-postagem devem ter o prefixo /prepostagem
  prePostagemCriar: '/prepostagem/v1/prepostagens',                    // POST para criar (retorna id)
  prePostagemRotulo: '/prepostagem/v1/prepostagens/rotulo/assincrono/pdf', // POST para gerar rótulo PDF (async - retorna idRecibo)
  prePostagemRotuloDownload: '/prepostagem/v1/prepostagens/rotulo/download/assincrono', // GET /{idRecibo} para baixar PDF após geração
  prePostagemRotuloSync: '/prepostagem/v1/prepostagens/rotulo/pdf',    // POST para gerar rótulo PDF (sync - pode não funcionar)
  prePostagemDeclaracao: '/prepostagem/v1/prepostagens/declaracaoconteudo', // GET /{ids}
  prePostagemAR: '/prepostagem/v1/prepostagens/avisorecebimento',      // GET /{ids}
  prePostagemConsulta: '/prepostagem/v2/prepostagens',                 // GET paginado para listar (CORRIGIDO: adicionado /prepostagem)
  // Lote (cartas simples)
  prePostagemLote: '/prepostagem/v1/prepostagens/lote',                // POST form-data
  prePostagemRotuloLote: '/prepostagem/v1/prepostagens/rotulo',        // POST com idsPrePostagem
  // Etiqueta por ID (para baixarEtiqueta - pode não funcionar no v1, usar gerarRotulo)
  prePostagemEtiqueta: '/prepostagem/v1/prepostagens',                 // GET /{id} - endpoint para consulta/download

  // Rastro (SRO - Sistema de Rastreamento de Objetos)
  // Conforme manual CWS: GET /srorastro/v1/objetos/{codigoObjeto}?resultado=T
  rastro: '/srorastro/v1/objetos',

  // CEP
  cep: '/cep/v2/enderecos',
} as const;

// ============================================================================
// Tipos de Objeto (tpObjeto)
// ============================================================================

export const TIPO_OBJETO = {
  ENVELOPE: 1,       // Envelope/Carta
  CAIXA_PACOTE: 2,   // Caixa ou Pacote
  ROLO_PRISMA: 3,    // Rolo ou Prisma
} as const;

export type TipoObjeto = typeof TIPO_OBJETO[keyof typeof TIPO_OBJETO];

// ============================================================================
// Códigos de Serviços Adicionais
// ============================================================================

export const SERVICO_ADICIONAL = {
  AVISO_RECEBIMENTO: '001',       // AR - Aviso de Recebimento
  MAO_PROPRIA: '002',             // MP - Mão Própria
  VALOR_DECLARADO: '019',         // VD - Valor Declarado
  REGISTRO: '025',                // Registro
  GRANDES_FORMATOS: '057',        // Grandes Formatos
  COLETA_PROGRAMADA: '064',       // Coleta Programada Domiciliar
} as const;

// ============================================================================
// Códigos de Serviço Comuns (exemplos - variam por contrato)
// ============================================================================

/**
 * ATENÇÃO: Estes códigos são EXEMPLOS baseados em contratos típicos.
 * Os códigos reais dependem do seu contrato específico com os Correios.
 * Consulte a resposta do token ou o portal CWS para obter os códigos corretos.
 */
export const SERVICOS_CORREIOS_EXEMPLO = {
  // SEDEX (expressos)
  SEDEX: '03220',
  SEDEX_10: '03158',
  SEDEX_12: '03140',
  SEDEX_HOJE: '03204',
  SEDEX_GRANDES_FORMATOS: '03212',

  // PAC (econômicos)
  PAC: '03298',
  PAC_GRANDES_FORMATOS: '03328',

  // Mini Envios
  MINI_ENVIOS: '04227',

  // Logística Reversa
  SEDEX_LOGISTICA_REVERSA: '04677',
  PAC_LOGISTICA_REVERSA: '04685',

  // Impresso
  IMPRESSO: '20010',
} as const;

// ============================================================================
// Configuração Padrão de Serviços
// ============================================================================

import type { CorreiosServiceConfig } from './types';

/**
 * Configuração padrão de serviços dos Correios
 * AJUSTE os códigos conforme seu contrato específico
 */
export const DEFAULT_CORREIOS_SERVICES: CorreiosServiceConfig[] = [
  {
    codigoServico: '03298',
    coProduto: '03298',
    nomeExibicao: 'PAC',
    habilitado: true,
    ordemExibicao: 1,
  },
  {
    codigoServico: '03220',
    coProduto: '03220',
    nomeExibicao: 'SEDEX',
    habilitado: true,
    ordemExibicao: 2,
  },
  {
    codigoServico: '03158',
    coProduto: '03158',
    nomeExibicao: 'SEDEX 10',
    habilitado: false, // Desabilitado por padrão (não disponível em todos os contratos)
    ordemExibicao: 3,
  },
  {
    codigoServico: '03140',
    coProduto: '03140',
    nomeExibicao: 'SEDEX 12',
    habilitado: false,
    ordemExibicao: 4,
  },
  {
    codigoServico: '03204',
    coProduto: '03204',
    nomeExibicao: 'SEDEX Hoje',
    habilitado: false,
    ordemExibicao: 5,
  },
  {
    codigoServico: '04227',
    coProduto: '04227',
    nomeExibicao: 'Mini Envios',
    habilitado: false,
    ordemExibicao: 6,
  },
];

// ============================================================================
// Limites e Restrições
// ============================================================================

export const CORREIOS_LIMITS = {
  // Peso máximo (kg)
  PESO_MAX_PAC: 30,
  PESO_MAX_SEDEX: 30,
  PESO_MAX_MINI: 0.3,  // 300g

  // Dimensões máximas (cm)
  SOMA_DIMENSOES_MAX: 200,  // comprimento + largura + altura
  COMPRIMENTO_MAX: 100,
  LARGURA_MAX: 100,
  ALTURA_MAX: 100,

  // Dimensões mínimas (cm)
  COMPRIMENTO_MIN: 16,
  LARGURA_MIN: 11,
  ALTURA_MIN: 2,

  // Valor declarado
  VALOR_DECLARADO_MAX: 10000, // R$ 10.000,00

  // Lotes
  MAX_OBJETOS_POR_LOTE_PRECO: 5,
  MAX_OBJETOS_POR_LOTE_PRAZO: 5,
  MAX_OBJETOS_POR_LOTE_PREPOSTAGEM: 100,
} as const;

// ============================================================================
// Mensagens de Erro Conhecidas
// ============================================================================

export const CORREIOS_ERROR_MESSAGES: Record<string, string> = {
  // Autenticação
  '401': 'Credenciais inválidas. Verifique usuário e senha.',
  '403': 'Acesso negado. Verifique as permissões do cartão de postagem.',

  // CEP
  'CEP_INVALIDO': 'CEP de origem ou destino inválido.',
  'CEP_NAO_ENCONTRADO': 'CEP não encontrado na base dos Correios.',

  // Preço
  'SERVICO_INDISPONIVEL': 'Serviço não disponível para o trecho informado.',
  'PESO_EXCEDIDO': 'Peso excede o limite permitido para o serviço.',
  'DIMENSOES_INVALIDAS': 'Dimensões do objeto excedem os limites permitidos.',

  // Pré-Postagem
  'CARTAO_SEM_SALDO': 'Cartão de postagem sem saldo disponível.',
  'CONTRATO_INATIVO': 'Contrato inativo ou suspenso.',
};

// ============================================================================
// Status de Rastreamento Mapeados
// ============================================================================

export const TRACKING_STATUS_MAP: Record<string, string> = {
  // Postagem
  'BDE': 'Objeto entregue',
  'BDI': 'Objeto entregue',
  'BDR': 'Objeto devolvido',
  'BLQ': 'Objeto bloqueado',
  'CAR': 'Objeto carregado',

  // Em trânsito
  'DO': 'Objeto em trânsito',
  'FC': 'Objeto em trânsito',
  'LDI': 'Objeto saiu para entrega',
  'OEC': 'Objeto saiu para entrega',
  'PAR': 'Objeto na unidade de distribuição',
  'PMT': 'Objeto postado',
  'PO': 'Objeto postado',
  'RO': 'Objeto em trânsito',

  // Problemas
  'EST': 'Objeto extraviado',
  'LDE': 'Tentativa de entrega não efetuada',
};
