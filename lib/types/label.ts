export type LabelStatus = 'pending' | 'paid' | 'issued' | 'canceled' | 'error';

export type PrintStatus = 'printed' | 'not_printed' | 'all';

export type PackageLabelStatus = 'pending' | 'generated' | 'canceled' | 'error';

export interface LabelFile {
  url?: string;
  base64?: string;
  contentType?: string;
  sizeBytes?: number | null;
}

/**
 * Dados de um volume/package para exibição na tabela de etiquetas
 */
export interface PackageItem {
  id: string;
  packageNumber: number;
  // Dimensões e peso
  weight: number;           // kg
  width: number;            // cm
  height: number;           // cm
  length: number;           // cm
  // Rastreio Correios
  carrierTrackingCode?: string | null;
  carrierPrePostageId?: string | null;
  // Status da etiqueta deste volume
  labelStatus: PackageLabelStatus;
  // Conteúdo declarado (simplificado para exibição)
  contentType: 'declaration' | 'nfe' | 'unknown';
  contentSummary?: string;  // Ex: "3 itens" ou "NF-e: 35241...789"
  contentValue?: number;    // Valor declarado do conteúdo
}

/**
 * Dados da origem para exibição
 */
export interface OriginInfo {
  label?: string;           // Apelido do endereço (ex: "Casa", "Trabalho")
  cep: string;
  city?: string;
  state?: string;
}

export interface LabelItem {
  id: string;
  shipmentId: string;
  carrier: string;           // ex.: "Correios", "Jadlog"
  service: string;           // ex.: "Sedex", "43523 - Expresso"
  status: LabelStatus;
  price: number;             // em REAIS para exibição
  currency: 'BRL';
  trackingCode?: string | null;  // platformTrackingCode
  isPrinted: boolean;        // Status de impressão
  printedAt?: string | null; // ISO

  // Dados da origem
  origin: OriginInfo;

  // Dados do destino (recipient)
  destinationCep: string;
  recipient: {
    name: string;            // **OBRIGATÓRIO EXIBIR NA LISTA**
    document?: string | null; // CPF/CNPJ
    city?: string | null;
    state?: string | null;
  };

  // Volumes/Packages
  packages: PackageItem[];
  totalVolumes: number;

  createdAt: string;         // ISO
  updatedAt?: string;
  file?: LabelFile | null;   // PDF metadata (emitida -> disponível)
}

export interface LabelsQuery {
  page?: number;
  pageSize?: number;
  q?: string;                // Busca por código/ID do envio
  printStatus?: PrintStatus; // Filtro de status de impressão
}

export interface LabelsResponse {
  items: LabelItem[];
  page: number;
  pageSize: number;
  total: number;
}
