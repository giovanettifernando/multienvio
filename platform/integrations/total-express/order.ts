import 'server-only';

import type { TESmartLabelRequest, TESmartLabelResponse } from './types';
import { TEApiError } from './types';
import { TE_ENDPOINTS, TE_DELIVERY_TYPES } from './constants';
import { teFetch } from './client';

export interface CreateTEOrderInput {
  tipoServico: string;
  numeroPedido?: string;
  remetente: {
    nome: string;
    cnpjCpf: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
    telefone?: string;
    email?: string;
  };
  destinatario: {
    nome: string;
    cnpjCpf?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
    telefone?: string;
    email?: string;
  };
  volumes: Array<{
    pesoKg: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
  }>;
  conteudo?: string;
  valorDeclarado?: number;
  notaFiscal?: {
    numero: string;
    serie: string;
    chaveAcesso: string;
    valorTotal: number;
    dataEmissao?: string;
  };
}

export async function createTEOrder(
  input: CreateTEOrderInput
): Promise<TESmartLabelResponse> {
  if (!input.tipoServico) throw new TEApiError('VALIDATION', 'tipoServico é obrigatório');
  if (!input.remetente?.cep) throw new TEApiError('VALIDATION', 'CEP do remetente é obrigatório');
  if (!input.destinatario?.cep) throw new TEApiError('VALIDATION', 'CEP do destinatário é obrigatório');
  if (!input.volumes?.length) throw new TEApiError('VALIDATION', 'Ao menos um volume é obrigatório');

  const body: TESmartLabelRequest = {
    tipoServico: input.tipoServico,
    tipoEntrega: TE_DELIVERY_TYPES.NORMAL,
    remetente: {
      nome: input.remetente.nome,
      cnpjCpf: input.remetente.cnpjCpf,
      logradouro: input.remetente.logradouro,
      numero: input.remetente.numero,
      complemento: input.remetente.complemento,
      bairro: input.remetente.bairro,
      cep: input.remetente.cep.replace(/\D/g, ''),
      cidade: input.remetente.cidade,
      uf: input.remetente.uf,
      telefone: input.remetente.telefone,
      email: input.remetente.email,
    },
    destinatario: {
      nome: input.destinatario.nome,
      cnpjCpf: input.destinatario.cnpjCpf,
      logradouro: input.destinatario.logradouro,
      numero: input.destinatario.numero,
      complemento: input.destinatario.complemento,
      bairro: input.destinatario.bairro,
      cep: input.destinatario.cep.replace(/\D/g, ''),
      cidade: input.destinatario.cidade,
      uf: input.destinatario.uf,
      telefone: input.destinatario.telefone,
      email: input.destinatario.email,
    },
    volumes: input.volumes.map((v) => ({
      pesoG: Math.round(v.pesoKg * 1000),
      comprimento: Math.round(v.comprimentoCm),
      largura: Math.round(v.larguraCm),
      altura: Math.round(v.alturaCm),
    })),
    conteudo: input.conteudo || 'Mercadoria',
    valorDeclarado: input.valorDeclarado,
    numeroPedido: input.numeroPedido,
    notaFiscal: input.notaFiscal ? {
      numero: input.notaFiscal.numero,
      serie: input.notaFiscal.serie,
      chaveAcesso: input.notaFiscal.chaveAcesso,
      valorTotal: input.notaFiscal.valorTotal,
      dataEmissao: input.notaFiscal.dataEmissao,
    } : undefined,
  };

  console.log('[TE_ORDER] Creating Smart Label order:', {
    tipoServico: input.tipoServico,
    numeroPedido: input.numeroPedido,
    remetenteCep: input.remetente.cep,
    destinatarioCep: input.destinatario.cep,
    volumes: input.volumes.length,
  });

  const response = await teFetch<TESmartLabelResponse>(TE_ENDPOINTS.smartLabel, {
    method: 'POST',
    body: body as unknown as Record<string, unknown>,
  });

  console.log('[TE_ORDER] Smart Label response:', {
    status: response.status,
    awb: response.awb || response.volumes?.[0]?.awb,
    volumes: response.volumes?.length,
  });

  return response;
}
