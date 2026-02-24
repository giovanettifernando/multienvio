/**
 * POST /api/admin/integrations/jt/test
 *
 * Testes da integração J&T Express (Admin)
 * Suporta tipos: auth, quote, order
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { testJTAuth } from '@/platform/integrations/jt/client';
import { cotarJT } from '@/platform/integrations/jt/cotacao';
import { createJTOrder } from '@/platform/integrations/jt/order';
import { printJTLabel } from '@/platform/integrations/jt/label';

const senderReceiverSchema = z.object({
  name: z.string(),
  company: z.string().optional(),
  postCode: z.string(),
  mailBox: z.string().optional(),
  taxNumber: z.string().optional(),
  mobile: z.string().optional(),
  phone: z.string().optional(),
  prov: z.string(),
  city: z.string(),
  street: z.string(),
  streetNumber: z.string().optional(),
  address: z.string().optional(),
  areaCode: z.string().optional(),
  ieNumber: z.string().optional(),
  area: z.string().optional(),
});

const testSchema = z.object({
  type: z.enum(['auth', 'quote', 'order']),
  // Campos para teste de cotação
  cepOrigem: z.string().optional(),
  cepDestino: z.string().optional(),
  pesoKg: z.number().optional(),
  valorDeclarado: z.number().optional(),
  goodsTypeCode: z.string().optional(),
  // Campos para teste de pedido
  orderData: z.object({
    sender: senderReceiverSchema,
    receiver: senderReceiverSchema,
    weight: z.number(),
    height: z.number().optional(),
    width: z.number().optional(),
    length: z.number().optional(),
    goodsType: z.string().optional(),
    itemName: z.string().optional(),
    itemQuantity: z.number().optional(),
    invoiceNumber: z.string().optional(),
    invoiceSerialNumber: z.string().optional(),
    invoiceMoney: z.string().optional(),
    invoiceAccessKey: z.string().optional(),
    taxCode: z.string().optional(),
  }).optional(),
});

export const POST = withApiHandler<Record<string, unknown>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { type } = parsed.data;

  switch (type) {
    case 'auth': {
      const result = await testJTAuth();
      return {
        data: {
          success: result.success,
          type: 'auth',
          message: result.message,
          result: {
            passwordHash: result.passwordHash,
            bodyDigest: result.bodyDigest,
            headerDigest: result.headerDigest,
          },
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
    }

    case 'quote': {
      const cepDestino = parsed.data.cepDestino;
      const pesoKg = parsed.data.pesoKg;

      if (!cepDestino || !pesoKg) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'CEP destino e peso são obrigatórios para teste de cotação',
          status: 400,
        });
      }

      const startTime = Date.now();

      try {
        const response = await cotarJT({
          destCep: cepDestino,
          pesoKg,
          originCep: parsed.data.cepOrigem,
          valorDeclarado: parsed.data.valorDeclarado,
          goodsTypeCode: parsed.data.goodsTypeCode,
        });

        const latencyMs = Date.now() - startTime;

        return {
          data: {
            success: true,
            type: 'quote',
            message: `Cotação realizada com sucesso`,
            result: {
              custo: response.data?.cost,
              prazoDias: response.data?.aging,
              seguroRisco: response.data?.riskPremiumFee,
              totalComSeguro: response.data?.riskPremiumWaybillFee,
            },
            latencyMs,
            jtApiResponse: response,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
          data: {
            success: false,
            type: 'quote',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs,
          },
        };
      }
    }

    case 'order': {
      const orderData = parsed.data.orderData;

      if (!orderData) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'Dados do pedido são obrigatórios',
          status: 400,
        });
      }

      const txlogisticId = `TEST-${Date.now()}`;
      const startTime = Date.now();

      try {
        // 1. Criar pedido
        const orderResponse = await createJTOrder({
          txlogisticId,
          sender: orderData.sender,
          receiver: orderData.receiver,
          weight: orderData.weight,
          height: orderData.height,
          width: orderData.width,
          length: orderData.length,
          goodsType: orderData.goodsType,
          totalQuantity: orderData.itemQuantity || 1,
          items: orderData.itemName ? [{
            itemName: orderData.itemName,
            number: orderData.itemQuantity || 1,
            itemType: orderData.goodsType,
          }] : undefined,
          invoiceNumber: orderData.invoiceNumber,
          invoiceSerialNumber: orderData.invoiceSerialNumber,
          invoiceMoney: orderData.invoiceMoney,
          invoiceAccessKey: orderData.invoiceAccessKey,
          taxCode: orderData.taxCode,
        });

        const billCode = orderResponse.data?.billCode
          || orderResponse.data?.orderList?.[0]?.billCode;
        const orderLatencyMs = Date.now() - startTime;

        // 2. Se obteve billCode, tentar gerar etiqueta
        let labelBase64: string | undefined;
        let labelLatencyMs: number | undefined;

        if (billCode) {
          const labelStart = Date.now();
          try {
            const labelResponse = await printJTLabel(billCode);
            labelBase64 = labelResponse.data?.base64EncodeContent;
            labelLatencyMs = Date.now() - labelStart;
          } catch (labelError) {
            console.error('[JT_TEST] Label generation failed:', labelError);
          }
        }

        const totalLatencyMs = Date.now() - startTime;

        return {
          data: {
            success: true,
            type: 'order',
            message: billCode
              ? `Pedido criado com sucesso. BillCode: ${billCode}`
              : 'Pedido criado mas sem billCode retornado',
            result: {
              txlogisticId,
              billCode,
              orderLatencyMs,
              hasLabel: !!labelBase64,
              labelLatencyMs,
              labelBase64,
            },
            latencyMs: totalLatencyMs,
            jtApiResponse: orderResponse,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
          data: {
            success: false,
            type: 'order',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            result: { txlogisticId },
            latencyMs,
          },
        };
      }
    }
  }
});
