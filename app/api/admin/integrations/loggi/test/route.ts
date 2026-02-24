/**
 * POST /api/admin/integrations/loggi/test
 *
 * Testes da integração Loggi (Admin)
 * Suporta tipos: auth, quote, shipment
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { testLoggiAuth } from '@/platform/integrations/loggi/client';
import { cotarLoggi, loggiMoneyToReais } from '@/platform/integrations/loggi/cotacao';
import { createLoggiShipment } from '@/platform/integrations/loggi/shipment';
import { printLoggiLabel } from '@/platform/integrations/loggi/label';

const addressSchema = z.object({
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().optional(),
  bairro: z.string(),
  cep: z.string(),
  cidade: z.string(),
  uf: z.string(),
});

const testSchema = z.object({
  type: z.enum(['auth', 'quote', 'shipment']),
  // Campos para teste de cotação
  cepOrigem: z.string().optional(),
  cepDestino: z.string().optional(),
  pesoKg: z.number().optional(),
  comprimentoCm: z.number().optional(),
  larguraCm: z.number().optional(),
  alturaCm: z.number().optional(),
  valorDeclaradoCentavos: z.number().optional(),
  // Campos para teste de shipment
  shipmentData: z.object({
    sender: z.object({
      name: z.string(),
      phoneNumber: z.string(),
      federalTaxId: z.string().optional(),
      address: addressSchema,
    }),
    receiver: z.object({
      name: z.string(),
      email: z.string().optional(),
      phoneNumber: z.string(),
      federalTaxId: z.string().optional(),
      address: addressSchema,
    }),
    externalServiceId: z.string().optional(),
    freightType: z.string(),
    weightG: z.number(),
    lengthCm: z.number(),
    widthCm: z.number(),
    heightCm: z.number(),
    invoiceKey: z.string().optional(),
    invoiceSeries: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceTotalValue: z.number().optional(),
    invoiceIcms: z.string().optional(),
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
      const result = await testLoggiAuth();
      return {
        data: {
          success: result.success,
          type: 'auth',
          message: result.message,
          result: {
            tokenPrefix: result.tokenPrefix,
            expiresIn: result.expiresIn,
          },
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
    }

    case 'quote': {
      const cepOrigem = parsed.data.cepOrigem;
      const cepDestino = parsed.data.cepDestino;
      const pesoKg = parsed.data.pesoKg;

      if (!cepOrigem || !cepDestino || !pesoKg) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'CEP origem, CEP destino e peso são obrigatórios para teste de cotação',
          status: 400,
        });
      }

      const startTime = Date.now();

      try {
        const weightG = Math.round(pesoKg * 1000);
        const response = await cotarLoggi({
          originCep: cepOrigem,
          destCep: cepDestino,
          packages: [{
            weightG,
            lengthCm: parsed.data.comprimentoCm || 20,
            widthCm: parsed.data.larguraCm || 15,
            heightCm: parsed.data.alturaCm || 10,
            goodsValueCents: parsed.data.valorDeclaradoCentavos,
          }],
        });

        const latencyMs = Date.now() - startTime;

        // Extrair cotações formatadas
        const quotations = response.packagesQuotations?.[0]?.quotations?.map((q) => ({
          tipo: q.freightTypeLabel || q.freightType,
          freightType: q.freightType,
          prazoDias: q.sloInDays,
          precoReais: q.price?.totalAmount ? loggiMoneyToReais(q.price.totalAmount) : null,
          precoOriginal: q.price?.totalAmount,
        })) || [];

        return {
          data: {
            success: true,
            type: 'quote',
            message: `Cotação realizada: ${quotations.length} opção(ões) encontradas`,
            result: { quotations },
            latencyMs,
            loggiApiResponse: response,
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

    case 'shipment': {
      const shipmentData = parsed.data.shipmentData;

      if (!shipmentData) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'Dados do shipment são obrigatórios',
          status: 400,
        });
      }

      const externalServiceId = shipmentData.externalServiceId || 'DLVR-DROF-DOOR-STAN-01';
      const startTime = Date.now();

      try {
        // 1. Criar shipment
        const shipmentResponse = await createLoggiShipment({
          externalServiceId,
          sender: {
            name: shipmentData.sender.name,
            phoneNumber: shipmentData.sender.phoneNumber,
            federalTaxId: shipmentData.sender.federalTaxId || '00000000000191',
            address: shipmentData.sender.address,
          },
          receiver: {
            name: shipmentData.receiver.name,
            email: shipmentData.receiver.email,
            phoneNumber: shipmentData.receiver.phoneNumber,
            federalTaxId: shipmentData.receiver.federalTaxId || '00000000000',
            address: shipmentData.receiver.address,
          },
          packages: [{
            freightType: shipmentData.freightType,
            weightG: shipmentData.weightG,
            lengthCm: shipmentData.lengthCm,
            widthCm: shipmentData.widthCm,
            heightCm: shipmentData.heightCm,
            invoice: shipmentData.invoiceKey ? {
              key: shipmentData.invoiceKey,
              series: shipmentData.invoiceSeries || '001',
              number: shipmentData.invoiceNumber || '000000001',
              totalValue: String(shipmentData.invoiceTotalValue || 5000),
              icms: shipmentData.invoiceIcms || '00',
            } : undefined,
          }],
        });

        const shipmentLatencyMs = Date.now() - startTime;

        // Extrair loggiKey do primeiro pacote
        const firstPkg = shipmentResponse.packages?.[0];
        const loggiKey = firstPkg?.loggiKey;
        const trackingCode = firstPkg?.trackingCode;

        // 2. Se obteve loggiKey, tentar gerar etiqueta
        let labelBase64: string | undefined;
        let labelLatencyMs: number | undefined;

        if (loggiKey) {
          const labelStart = Date.now();
          try {
            const labelResponse = await printLoggiLabel([loggiKey]);
            labelBase64 = labelResponse.success?.content;
            labelLatencyMs = Date.now() - labelStart;
          } catch (labelError) {
            console.error('[LOGGI_TEST] Label generation failed:', labelError);
          }
        }

        const totalLatencyMs = Date.now() - startTime;

        return {
          data: {
            success: true,
            type: 'shipment',
            message: loggiKey
              ? `Shipment criado. LoggiKey: ${loggiKey}${trackingCode ? `, Tracking: ${trackingCode}` : ''}`
              : 'Shipment criado mas sem loggiKey retornado',
            result: {
              externalServiceId,
              loggiKey,
              trackingCode,
              shipmentLatencyMs,
              hasLabel: !!labelBase64,
              labelLatencyMs,
              labelBase64,
            },
            latencyMs: totalLatencyMs,
            loggiApiResponse: shipmentResponse,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
          data: {
            success: false,
            type: 'shipment',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            result: { externalServiceId },
            latencyMs,
          },
        };
      }
    }
  }
});
