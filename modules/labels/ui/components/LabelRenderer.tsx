"use client";

/**
 * Componente de renderização de etiquetas
 * Seleciona automaticamente o tipo correto de etiqueta baseado na transportadora
 */

import type {
  CorreiosLabelData,
  GenericLabelData,
  RoutingSymbol,
} from '@/shared/types/correios-label';
import { getRoutingSymbol } from "@/platform/integrations/correios/label-utils";
import { EtiquetaCorreios } from "./EtiquetaCorreios";
import { EtiquetaGenerica } from "./EtiquetaGenerica";
import { isCorreiosCarrier } from '@/shared/utils/carrier';

interface LabelData {
  /** Identificador único da etiqueta */
  id: string;
  /** Nome da transportadora */
  carrier: string;
  /** Código do serviço */
  serviceCode?: string;
  /** Nome do serviço */
  serviceName: string;
  /** Código de rastreamento */
  trackingCode?: string;
  /** Endereço do remetente */
  sender: {
    nome: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    documento?: string;
  };
  /** Endereço do destinatário */
  recipient: {
    nome: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    documento?: string;
  };
  /** Informações do volume */
  volume: {
    index: number;
    total: number;
    pesoKg: number;
    pesoCubadoKg?: number;
    dimensoes?: {
      comprimento: number;
      largura: number;
      altura: number;
    };
  };
  /** Serviços adicionais */
  additionalServices?: {
    ar?: boolean;
    mp?: boolean;
    vd?: number;
    dd?: boolean;
  };
  /** Código do cartão de postagem (Correios) */
  postingCardCode?: string;
  /** Número da NF-e */
  nfeNumber?: string;
}

interface LabelRendererProps {
  /** Dados da etiqueta */
  data: LabelData;
  /** Mostrar linha de corte */
  showCutLine?: boolean;
  /** Escala de visualização */
  scale?: number;
}

/**
 * Converte dados genéricos para formato Correios
 */
function toCorreiosData(data: LabelData): CorreiosLabelData {
  const routingSymbol: RoutingSymbol = data.serviceCode
    ? getRoutingSymbol(data.serviceCode)
    : "GENERIC";

  return {
    trackingCode: data.trackingCode || "",
    serviceCode: data.serviceCode || "",
    serviceName: data.serviceName,
    routingSymbol,
    sender: {
      nome: data.sender.nome,
      logradouro: data.sender.logradouro,
      numero: data.sender.numero,
      complemento: data.sender.complemento,
      bairro: data.sender.bairro,
      cidade: data.sender.cidade,
      uf: data.sender.uf,
      cep: data.sender.cep,
      telefone: data.sender.telefone,
      documento: data.sender.documento,
    },
    recipient: {
      nome: data.recipient.nome,
      logradouro: data.recipient.logradouro,
      numero: data.recipient.numero,
      complemento: data.recipient.complemento,
      bairro: data.recipient.bairro,
      cidade: data.recipient.cidade,
      uf: data.recipient.uf,
      cep: data.recipient.cep,
      telefone: data.recipient.telefone,
      documento: data.recipient.documento,
    },
    volume: {
      index: data.volume.index,
      total: data.volume.total,
      pesoKg: data.volume.pesoKg,
      pesoCubadoKg: data.volume.pesoCubadoKg,
      dimensoes: data.volume.dimensoes || {
        comprimento: 0,
        largura: 0,
        altura: 0,
      },
    },
    additionalServices: data.additionalServices || {},
    postingCardCode: data.postingCardCode || "000",
    nfeNumber: data.nfeNumber,
  };
}

/**
 * Converte dados genéricos para formato de etiqueta genérica
 */
function toGenericData(data: LabelData): GenericLabelData {
  return {
    trackingCode: data.trackingCode,
    carrier: data.carrier,
    serviceName: data.serviceName,
    sender: {
      nome: data.sender.nome,
      logradouro: data.sender.logradouro,
      numero: data.sender.numero,
      complemento: data.sender.complemento,
      bairro: data.sender.bairro,
      cidade: data.sender.cidade,
      uf: data.sender.uf,
      cep: data.sender.cep,
      telefone: data.sender.telefone,
      documento: data.sender.documento,
    },
    recipient: {
      nome: data.recipient.nome,
      logradouro: data.recipient.logradouro,
      numero: data.recipient.numero,
      complemento: data.recipient.complemento,
      bairro: data.recipient.bairro,
      cidade: data.recipient.cidade,
      uf: data.recipient.uf,
      cep: data.recipient.cep,
      telefone: data.recipient.telefone,
      documento: data.recipient.documento,
    },
    volume: {
      index: data.volume.index,
      total: data.volume.total,
      pesoKg: data.volume.pesoKg,
      pesoCubadoKg: data.volume.pesoCubadoKg,
      dimensoes: data.volume.dimensoes || {
        comprimento: 0,
        largura: 0,
        altura: 0,
      },
    },
    additionalServices: data.additionalServices,
  };
}

/**
 * Componente que renderiza a etiqueta correta baseado na transportadora
 */
export function LabelRenderer({ data, showCutLine, scale }: LabelRendererProps) {
  if (isCorreiosCarrier(data.carrier)) {
    return (
      <EtiquetaCorreios
        data={toCorreiosData(data)}
        showCutLine={showCutLine}
        scale={scale}
      />
    );
  }

  return (
    <EtiquetaGenerica
      data={toGenericData(data)}
      showCutLine={showCutLine}
      scale={scale}
    />
  );
}

export type { LabelData, LabelRendererProps };
