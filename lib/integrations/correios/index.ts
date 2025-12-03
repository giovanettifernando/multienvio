/**
 * Módulo de Integração com APIs dos Correios (CWS)
 *
 * Este módulo fornece integração completa com as APIs REST dos Correios:
 * - Autenticação via Token JWT
 * - Cotação de preço e prazo
 * - Pré-postagem (geração de código de rastreio e etiqueta)
 * - Rastreamento de objetos
 *
 * Configuração via variáveis de ambiente:
 * - CORREIOS_ENVIRONMENT: 'sandbox' | 'production'
 * - CORREIOS_API_BASE: URL base da API (opcional, usa default por ambiente)
 * - CORREIOS_USER: Usuário do componente CWS
 * - CORREIOS_PASSWORD: Senha do componente CWS
 * - CORREIOS_CARTAO_POSTAGEM: Número do cartão de postagem
 * - CORREIOS_CONTRATO: Número do contrato (opcional)
 * - CORREIOS_DR: Diretoria Regional (opcional)
 * - CORREIOS_SERVICOS: JSON com configuração de serviços (opcional)
 *
 * @example
 * ```typescript
 * import { cotarCorreiosDefault, criarPrePostagem } from '@/lib/integrations/correios';
 *
 * // Cotação
 * const cotacoes = await cotarCorreiosDefault({
 *   cepOrigem: '01310100',
 *   cepDestino: '22041080',
 *   pesoGramas: 500,
 *   comprimentoCm: 20,
 *   larguraCm: 15,
 *   alturaCm: 10,
 * });
 *
 * // Pré-postagem
 * const prePostagem = await criarPrePostagem({
 *   codigoServico: '03220', // SEDEX
 *   pesoGramas: 500,
 *   // ... demais dados
 * });
 * ```
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Client (autenticação e fetch)
export {
  getCorreiosConfig,
  getCorreiosConfigAsync,
  validateCorreiosConfig,
  getCorreiosToken,
  testCorreiosAuth,
  clearTokenCache,
  invalidateCorreiosConfigCache,
  correiosFetch,
  parseCorreiosDecimal,
  isCorreiosConfigured,
  getCorreiosConfigInfo,
  type CorreiosAuthTestResult,
} from './client';

// Preço e Prazo (cotação)
export {
  calcularPrecoCorreios,
  calcularPrazoCorreios,
  cotarCorreios,
  cotarCorreiosDefault,
  getCorreiosServicos,
} from './precoPrazo';

// Pré-Postagem (geração de rastreio e etiqueta)
export {
  criarPrePostagem,
  criarPrePostagemIndividual,
  criarLotePrePostagem,
  gerarRotulo,
  baixarRotuloPdf,
  buscarPrePostagemPorRastreio,
  consultarLotePrePostagem,
  baixarEtiqueta,
  baixarEtiquetasLote,
  prePostagemCompleta,
  type CreatePrePostagemInput,
  type PrePostagemResult,
  type EtiquetaResult,
  type FullPrePostagemResult,
  type EtiquetaFormato,
  type BuscaPrePostagemResult,
} from './prepostagem';

// Rastreamento
export {
  rastrearObjeto,
  rastrearObjetos,
  isValidTrackingCode,
  getTrackingCountry,
  isBrazilianTrackingCode,
  type TrackingEvent,
  type TrackingResult,
  type ResultadoRastro,
} from './rastro';
