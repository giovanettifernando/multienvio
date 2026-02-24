import 'server-only';

/**
 * Criação de pedidos na J&T Express (addOrder)
 *
 * Endpoint: POST /webopenplatformapi/api/order/addOrder
 *
 * Cria pedidos de envio na J&T e retorna o billCode (rastreio).
 * Valores fixos por contrato: expressType=EZ, orderType=2,
 * serviceType=02, deliveryType=03.
 */

import type {
  JTSenderReceiver,
  JTOrderItem,
  JTAddOrderResponse,
} from './types';
import { JTApiError } from './types';
import {
  JT_ENDPOINTS,
  JT_PRODUCT_TYPES,
  JT_ORDER_TYPE,
  JT_SERVICE_TYPE,
  JT_DELIVERY_TYPE,
  JT_GOODS_TYPES,
} from './constants';
import { jtFetch } from './client';

// ============================================================================
// Input
// ============================================================================

export interface CreateJTOrderInput {
  /** ID interno do pedido (ex: platformTrackingCode) */
  txlogisticId: string;
  /** Dados do remetente */
  sender: JTSenderReceiver;
  /** Dados do destinatário */
  receiver: JTSenderReceiver;
  /** Peso em kg */
  weight: number;
  /** Altura em cm */
  height?: number;
  /** Largura em cm */
  width?: number;
  /** Comprimento em cm */
  length?: number;
  /** Classificação de mercadoria (default: bm000006 = Outros) */
  goodsType?: string;
  /** Itens do pedido */
  items?: JTOrderItem[];
  /** Quantidade total de volumes */
  totalQuantity?: number;
  /** Número da NF */
  invoiceNumber?: string;
  /** Série da NF */
  invoiceSerialNumber?: string;
  /** Valor da NF */
  invoiceMoney?: string;
  /** Código fiscal */
  taxCode?: string;
  /** Chave de acesso da NF-e */
  invoiceAccessKey?: string;
  /** Data de emissão da NF */
  invoiceIssueDate?: string;
}

// ============================================================================
// Criar Pedido
// ============================================================================

/**
 * Cria um pedido de envio na J&T Express
 *
 * @returns Response com data.billCode (código de rastreio J&T)
 */
export async function createJTOrder(
  input: CreateJTOrderInput
): Promise<JTAddOrderResponse> {
  // Validações básicas
  if (!input.txlogisticId) {
    throw new JTApiError('VALIDATION', 'txlogisticId é obrigatório');
  }
  if (!input.sender?.name || !input.sender?.postCode) {
    throw new JTApiError('VALIDATION', 'Dados do remetente incompletos (nome e CEP obrigatórios)');
  }
  if (!input.receiver?.name || !input.receiver?.postCode) {
    throw new JTApiError('VALIDATION', 'Dados do destinatário incompletos (nome e CEP obrigatórios)');
  }
  if (!input.weight || input.weight <= 0) {
    throw new JTApiError('VALIDATION', 'Peso deve ser maior que zero');
  }

  // Montar bizContent (customerCode e digest são adicionados pelo jtFetch)
  const bizContent: Record<string, unknown> = {
    txlogisticId: input.txlogisticId,
    expressType: JT_PRODUCT_TYPES.EZ,
    orderType: JT_ORDER_TYPE.MONTHLY_BILLING,
    serviceType: JT_SERVICE_TYPE.STANDARD,
    deliveryType: JT_DELIVERY_TYPE.HOME,
    sender: input.sender,
    receiver: input.receiver,
    // translate = cópia do sender (conforme documentação J&T)
    translate: input.sender,
    goodsType: input.goodsType || JT_GOODS_TYPES.OTHER,
    weight: input.weight.toFixed(2),
  };

  // Dimensões (opcionais)
  if (input.height) bizContent.height = input.height;
  if (input.width) bizContent.width = input.width;
  if (input.length) bizContent.length = input.length;

  // Itens
  if (input.items && input.items.length > 0) {
    bizContent.items = input.items;
  }

  // Quantidade total
  if (input.totalQuantity) {
    bizContent.totalQuantity = input.totalQuantity;
  }

  // Dados de NF (opcionais)
  if (input.invoiceNumber) bizContent.invoiceNumber = input.invoiceNumber;
  if (input.invoiceSerialNumber) bizContent.invoiceSerialNumber = input.invoiceSerialNumber;
  if (input.invoiceMoney) bizContent.invoiceMoney = input.invoiceMoney;
  if (input.taxCode) bizContent.taxCode = input.taxCode;
  if (input.invoiceAccessKey) bizContent.invoiceAccessKey = input.invoiceAccessKey;
  if (input.invoiceIssueDate) bizContent.invoiceIssueDate = input.invoiceIssueDate;

  console.log('[JT_ORDER] Creating order:', {
    txlogisticId: input.txlogisticId,
    senderCep: input.sender.postCode,
    receiverCep: input.receiver.postCode,
    weight: input.weight,
  });

  const response = await jtFetch<JTAddOrderResponse>(
    JT_ENDPOINTS.addOrder,
    bizContent,
  );

  console.log('[JT_ORDER] Order response:', {
    code: response.code,
    msg: response.msg,
    billCode: response.data?.billCode || response.data?.orderList?.[0]?.billCode,
  });

  return response;
}
