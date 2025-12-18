/**
 * Tipos relacionados à Nota Fiscal Eletrônica (NF-e)
 */

// =====================================================
// TIPOS BÁSICOS PARA ESPELHO NF-e
// =====================================================

/** Identificação da NF-e */
export interface NFeIdentificacao {
  modelo?: string | null;        // Modelo do documento (55 = NF-e, 65 = NFC-e)
  serie?: string | null;         // Série da NF-e
  numero?: string | null;        // Número da NF-e
  dataEmissao?: string | null;   // Data de emissão (ISO string)
  naturezaOp?: string | null;    // Natureza da operação
  tipoOperacao?: string | null;  // 0 = Entrada, 1 = Saída
  ambiente?: string | null;      // 1 = Produção, 2 = Homologação
}

/** Endereço (usado por emitente e destinatário) */
export interface NFeEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  pais?: string | null;
  telefone?: string | null;
}

/** Emitente da NF-e */
export interface NFeEmitente {
  cnpjCpf?: string | null;       // CNPJ ou CPF do emitente
  ie?: string | null;            // Inscrição Estadual
  razaoSocial?: string | null;   // Razão Social
  nomeFantasia?: string | null;  // Nome Fantasia
  endereco?: NFeEndereco | null;
}

/** Destinatário da NF-e */
export interface NFeDestinatario {
  cnpjCpf?: string | null;       // CNPJ ou CPF do destinatário
  ie?: string | null;            // Inscrição Estadual
  nome?: string | null;          // Nome/Razão Social
  endereco?: NFeEndereco | null;
}

/** Impostos do item */
export interface NFeImpostosItem {
  icms?: {
    cst?: string | null;         // Código de Situação Tributária
    baseCalculo?: number | null;
    aliquota?: number | null;
    valor?: number | null;
  } | null;
  ipi?: {
    cst?: string | null;
    baseCalculo?: number | null;
    aliquota?: number | null;
    valor?: number | null;
  } | null;
  pis?: {
    cst?: string | null;
    baseCalculo?: number | null;
    aliquota?: number | null;
    valor?: number | null;
  } | null;
  cofins?: {
    cst?: string | null;
    baseCalculo?: number | null;
    aliquota?: number | null;
    valor?: number | null;
  } | null;
}

/** Totais da NF-e */
export interface NFeTotais {
  baseCalculoIcms?: number | null;   // Base de cálculo do ICMS
  valorIcms?: number | null;         // Valor do ICMS
  valorProdutos?: number | null;     // Valor total dos produtos
  valorFrete?: number | null;        // Valor do frete
  valorSeguro?: number | null;       // Valor do seguro
  valorDesconto?: number | null;     // Valor do desconto
  valorOutros?: number | null;       // Outras despesas acessórias
  valorIpi?: number | null;          // Valor do IPI
  valorPis?: number | null;          // Valor do PIS
  valorCofins?: number | null;       // Valor do COFINS
  valorTotal?: number | null;        // Valor total da NF-e
}

/** Pagamento da NF-e */
export interface NFePagamento {
  forma?: string | null;             // Forma de pagamento (código)
  formaDescricao?: string | null;    // Descrição da forma de pagamento
  valor?: number | null;             // Valor do pagamento
}

/** Protocolo de autorização */
export interface NFeProtocolo {
  numero?: string | null;            // Número do protocolo
  dataAutorizacao?: string | null;   // Data de autorização (ISO string)
  status?: string | null;            // Código de status
  motivo?: string | null;            // Descrição do status
}

// =====================================================
// TIPOS DE ITENS E INVOICE
// =====================================================

export interface InvoiceItem {
  id: string;                        // índice ou código interno
  sku?: string | null;               // Código do produto (cProd)
  descricao: string;                 // Descrição do produto
  ncm?: string | null;               // Nomenclatura Comum do Mercosul
  cfop?: string | null;              // Código Fiscal de Operações e Prestações
  unidade?: string | null;           // Unidade comercial (uCom)
  quantidade: number;                // Quantidade
  pesoLiquido?: number | null;       // Peso líquido em kg
  valorUnitario: number;             // Valor unitário
  valorTotal: number;                // Valor total do item
  impostos?: NFeImpostosItem | null; // Impostos do item
}

export interface PackageInvoice {
  chave: string;           // Chave de 44 dígitos
  xmlId?: string | null;   // Identificador/filename do XML
  items: InvoiceItem[];    // Itens da NF desse pacote
}

export interface InvoiceData {
  chave: string;                       // Chave de 44 dígitos
  numero: string;                      // Número da NF-e
  serie: string;                       // Série da NF-e
  valorTotal: number;                  // Valor total da nota
  items: InvoiceItem[];                // Itens da nota
  // Dados adicionais para espelho NF-e (opcionais)
  identificacao?: NFeIdentificacao | null;
  emitente?: NFeEmitente | null;
  destinatario?: NFeDestinatario | null;
  totais?: NFeTotais | null;
  pagamentos?: NFePagamento[] | null;
  protocolo?: NFeProtocolo | null;
}

export interface ParseXmlRequest {
  xml: string;             // Conteúdo do XML da NF-e
}

export interface ParseXmlResponse {
  success: boolean;
  data?: InvoiceData;
  error?: string;
}

export interface GetInvoiceByKeyRequest {
  chave: string;           // Chave de 44 dígitos
}

export interface GetInvoiceByKeyResponse {
  success: boolean;
  data?: InvoiceData;
  error?: string;
}
