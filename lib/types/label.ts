export type LabelStatus = 'pending' | 'paid' | 'issued' | 'canceled' | 'error';

export interface LabelFile {
  // preferencialmente uma URL (quando existir). Se vier base64, marcar contentType.
  url?: string;           // ex.: "/api/labels/{id}/pdf" (mock no FE)
  base64?: string;        // se o mock devolver base64
  contentType?: string;   // "application/pdf"
  sizeBytes?: number | null;
}

export interface LabelItem {
  id: string;
  shipmentId: string;
  carrier: string;           // ex.: "Correios", "Jadlog"
  service: string;           // ex.: "Sedex", "43523 - Expresso"
  status: LabelStatus;
  price: number;             // em centavos ou reais? use number em reais para exibição simples
  currency: 'BRL';
  recipient: {
    name: string;            // **OBRIGATÓRIO EXIBIR NA LISTA**
    document?: string | null; // CPF/CNPJ
    city?: string | null;
    state?: string | null;
  };
  createdAt: string;         // ISO
  updatedAt?: string;
  file?: LabelFile | null;   // PDF metadata (emitida -> disponível)
  trackingCode?: string | null;
}

export interface LabelsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: LabelStatus | 'all';
  carrier?: string | 'all';
  dateStart?: string; // ISO
  dateEnd?: string;   // ISO
}

export interface LabelsResponse {
  items: LabelItem[];
  page: number;
  pageSize: number;
  total: number;
}
