import type { ShipmentFormData as ShipmentFormDataSchema } from '@/shared/validation/shipment';
import type { CompanyWizardData } from '@/shared/validation/company';

/**
 * Form data inferida do schema (entrada do formulário).
 * Mantenha apenas o alias para evitar import cíclico.
 */
export type ShipmentFormData = ShipmentFormDataSchema;

export type ShipmentStatus =
  | "aguardando_coleta"
  | "postado"
  | "em_transito"
  | "em_rota_de_entrega"
  | "entregue"
  | "pendente";

export type ShipmentTag = "express" | "economico" | "seguro" | "declarado";

/**
 * Estrutura mínima persistida em memória.
 * Deve ser estável, simples e serializável.
 */
export type StoredShipment = {
  id: string;
  createdAt: string; // ISO
  status: ShipmentStatus; // mantém enum usado no projeto
  sender: CompanyWizardData; // PF ou PJ
  recipient: ShipmentFormData["destinatario"];
  package: ShipmentFormData["pacote"];
  service: ShipmentFormData["servico"] & {
    name?: string; // info amigável
    carrier?: string; // exibição
    price?: number; // cache de preço
    etaDays?: number; // estimativa
  };
  price: number;
  etaDays: number;
  codigoRastreio: string;
  destinatarioNome: string;
  cidadeDestino: string;
  label?: {
    labelId: string;
    pdfUrl: string;
  } | null;
};

/**
 * Registro enriquecido para grids/listas (se necessário).
 * Se quiser, pode ser igual ao StoredShipment, mas mantemos separado
 * para evoluções de UI sem quebrar o armazenamento.
 */
export type ShipmentRecord = StoredShipment;

/**
 * Tipo usado nas listas da UI (cards/tables).
 * Já existe no projeto; manter compatibilidade.
 */
export type Shipment = {
  id: string;
  codigoRastreio: string;
  destinatario: string;
  cidadeOrigem: string;
  cidadeDestino: string;
  servico: string;
  status: ShipmentStatus;
  atualizadoEm: string;
  prazoEstimado: string; // ex. "3 dias"
  valorFrete: number;
  servicoCodigo: string;
  pesoKg?: number;
  comprimentoCm?: number;
  larguraCm?: number;
  alturaCm?: number;
  tags?: ShipmentTag[];
  remetente?: string;
};
