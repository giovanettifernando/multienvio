/**
 * Tipos relacionados à Nota Fiscal Eletrônica (NF-e)
 */

export interface InvoiceItem {
  id: string;              // índice ou código interno
  sku?: string | null;     // Código do produto
  descricao: string;       // Descrição do produto
  ncm?: string | null;     // Nomenclatura Comum do Mercosul
  cfop?: string | null;    // Código Fiscal de Operações e Prestações
  quantidade: number;      // Quantidade
  pesoLiquido?: number | null;  // Peso líquido em kg
  valorUnitario: number;   // Valor unitário
  valorTotal: number;      // Valor total do item
}

export interface PackageInvoice {
  chave: string;           // Chave de 44 dígitos
  xmlId?: string | null;   // Identificador/filename do XML
  items: InvoiceItem[];    // Itens da NF desse pacote
}

export interface InvoiceData {
  chave: string;           // Chave de 44 dígitos
  numero: string;          // Número da NF-e
  serie: string;           // Série da NF-e
  valorTotal: number;      // Valor total da nota
  items: InvoiceItem[];    // Itens da nota
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
