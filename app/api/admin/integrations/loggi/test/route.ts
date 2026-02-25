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
import { testLoggiAuth, resetLoggiCircuitBreaker, getLoggiCircuitBreakerState } from '@/platform/integrations/loggi/client';
import { cotarLoggi, loggiMoneyToReais } from '@/platform/integrations/loggi/cotacao';
import { createLoggiShipment, type CreateLoggiShipmentInput } from '@/platform/integrations/loggi/shipment';
import { printLoggiLabel } from '@/platform/integrations/loggi/label';
import { getLoggiTracking } from '@/platform/integrations/loggi/tracking';
import { LoggiApiError, type LoggiQuotation } from '@/platform/integrations/loggi/types';

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
  type: z.enum(['auth', 'quote', 'shipment', 'label', 'label-sdk', 'tracking', 'reset-cb']),
  // Campos para geração de etiqueta / rastreamento
  loggiKey: z.string().optional(),
  trackingCode: z.string().optional(),
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

      const startTime = Date.now();
      let externalServiceId = shipmentData.externalServiceId;
      let quoteInfo: { quotations: LoggiQuotation[]; quoteLatencyMs: number } | undefined;
      let shipmentInput: CreateLoggiShipmentInput | undefined;

      try {
        // 1. Auto-resolve externalServiceId via cotação se não fornecido ou usando default

        if (!externalServiceId || externalServiceId === 'DLVR-DROF-DOOR-STAN-01') {
          const quoteStart = Date.now();
          const quoteResponse = await cotarLoggi({
            originCep: shipmentData.sender.address.cep,
            destCep: shipmentData.receiver.address.cep,
            packages: [{
              weightG: shipmentData.weightG,
              lengthCm: shipmentData.lengthCm,
              widthCm: shipmentData.widthCm,
              heightCm: shipmentData.heightCm,
            }],
          });

          const allQuotations = quoteResponse.packagesQuotations?.[0]?.quotations || [];
          const quoteLatencyMs = Date.now() - quoteStart;

          // Find matching freight type or use first available
          const targetFreightType = shipmentData.freightType;
          const matched = allQuotations.find((q) => q.freightType === targetFreightType);
          const selected = matched || allQuotations[0];

          if (!selected) {
            return {
              data: {
                success: false,
                type: 'shipment',
                message: 'Nenhuma cotação encontrada para esta rota. Verifique os CEPs.',
                result: { quoteLatencyMs },
                latencyMs: Date.now() - startTime,
              },
            };
          }

          externalServiceId = selected.externalServiceId;
          quoteInfo = { quotations: allQuotations, quoteLatencyMs };

          console.log('[LOGGI_TEST] Auto-resolved externalServiceId via quote:', {
            externalServiceId,
            freightType: selected.freightType,
            sloInDays: selected.sloInDays,
          });
        }

        // 2. Construir input do shipment
        shipmentInput = {
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
            federalTaxId: shipmentData.receiver.federalTaxId || '12345678909',
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
            contentDeclaration: !shipmentData.invoiceKey ? {
              totalValue: '1',
              description: 'Mercadorias diversas (teste)',
            } : undefined,
          }],
        };

        // 3. Criar shipment
        const shipmentResponse = await createLoggiShipment(shipmentInput);

        const shipmentLatencyMs = Date.now() - startTime;

        // Extrair loggiKey do primeiro pacote
        const firstPkg = shipmentResponse.packages?.[0];
        const loggiKey = firstPkg?.loggiKey;
        const trackingCode = firstPkg?.trackingCode;

        // NÃO tentar gerar etiqueta imediatamente — Loggi processa async-shipments
        // em background. A etiqueta só estará disponível após processamento (~30-60s).
        const totalLatencyMs = Date.now() - startTime;

        return {
          data: {
            success: true,
            type: 'shipment',
            message: loggiKey
              ? `Shipment criado (async). LoggiKey: ${loggiKey}${trackingCode ? `, Tracking: ${trackingCode}` : ''}. Aguarde ~60s para gerar etiqueta.`
              : 'Shipment criado mas sem loggiKey retornado',
            result: {
              externalServiceId,
              loggiKey,
              trackingCode,
              shipmentLatencyMs,
              hasLabel: false,
              quoteInfo: quoteInfo ? {
                quotationsCount: quoteInfo.quotations.length,
                quoteLatencyMs: quoteInfo.quoteLatencyMs,
                selectedService: externalServiceId,
              } : undefined,
            },
            latencyMs: totalLatencyMs,
            loggiApiResponse: shipmentResponse,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const apiDetails = error instanceof LoggiApiError ? error.details : undefined;
        return {
          data: {
            success: false,
            type: 'shipment',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            result: {
              externalServiceId: externalServiceId ?? shipmentData.externalServiceId,
              quoteInfo: quoteInfo ? {
                quotationsCount: quoteInfo.quotations.length,
                quoteLatencyMs: quoteInfo.quoteLatencyMs,
                selectedService: externalServiceId,
              } : undefined,
              apiErrorDetails: apiDetails,
            },
            latencyMs,
            // Incluir payload enviado para debug
            loggiApiResponse: {
              error: error instanceof Error ? error.message : String(error),
              requestPayload: shipmentInput ? JSON.parse(JSON.stringify(shipmentInput)) : undefined,
            },
          },
        };
      }
    }

    case 'label': {
      const loggiKey = parsed.data.loggiKey;
      if (!loggiKey) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'loggiKey é obrigatório para gerar etiqueta',
          status: 400,
        });
      }

      const startTime = Date.now();
      try {
        const labelResponse = await printLoggiLabel([loggiKey]);
        const labelBase64 = labelResponse.success?.content;
        const failures = labelResponse.failure;
        const latencyMs = Date.now() - startTime;

        let labelMessage = 'Etiqueta gerada com sucesso';
        if (!labelBase64) {
          if (failures?.length) {
            const failureDetail = failures.map((f) =>
              `${f.loggiKey}: [${f.status?.code}] ${f.status?.message}`
            ).join('; ');
            labelMessage = `Etiqueta com falha: ${failureDetail}`;
          } else {
            labelMessage = 'Etiqueta sem conteudo na resposta (pode estar em processamento)';
          }
        }

        return {
          data: {
            success: !!labelBase64,
            type: 'label',
            message: labelMessage,
            result: {
              loggiKey,
              hasLabel: !!labelBase64,
              labelBase64,
              labelLatencyMs: latencyMs,
              failures: failures?.length ? failures : undefined,
            },
            latencyMs,
            loggiApiResponse: labelResponse,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const apiDetails = error instanceof LoggiApiError ? error.details : undefined;
        const errorCode = error instanceof LoggiApiError ? error.code : undefined;
        return {
          data: {
            success: false,
            type: 'label',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            result: { loggiKey, apiErrorDetails: apiDetails },
            latencyMs,
            loggiApiResponse: {
              error: error instanceof Error ? error.message : String(error),
              errorCode,
              details: apiDetails,
            },
          },
        };
      }
    }

    case 'label-sdk': {
      const loggiKey = parsed.data.loggiKey;
      if (!loggiKey) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'loggiKey é obrigatório para gerar etiqueta via SDK',
          status: 400,
        });
      }

      const startTime = Date.now();
      try {
        // Usar o SDK oficial @api/loggi-platform
        const loggiPlatform = (await import('@api/loggi-platform')).default;
        const { getLoggiConfigAsync } = await import('@/platform/integrations/loggi/client');

        const config = await getLoggiConfigAsync();

        // Configurar server e autenticar via SDK
        loggiPlatform.server(config.apiBase);

        const authResponse = await loggiPlatform.requestOAuthToken({
          client_id: config.clientId,
          client_secret: config.clientSecret,
        });

        const token = authResponse.data?.idToken;
        if (!token) {
          return {
            data: {
              success: false,
              type: 'label-sdk',
              message: 'SDK Auth: token não retornado',
              result: { authResponse: authResponse.data },
              latencyMs: Date.now() - startTime,
            },
          };
        }

        // Setar token no SDK
        loggiPlatform.auth(token);

        // Gerar etiqueta via SDK unificado
        const labelResponse = await loggiPlatform.createLabel(
          {
            loggiKeys: [loggiKey],
            responseType: 'LABEL_RESPONSE_TYPE_BASE_64',
            format: 'LABEL_FORMAT_PDF',
            layout: 'LABEL_LAYOUT_A4',
          },
          { company_id: config.companyId },
        );

        const latencyMs = Date.now() - startTime;
        const labelData = labelResponse.data;
        const labelBase64 = labelData?.success?.content;

        return {
          data: {
            success: !!labelBase64,
            type: 'label-sdk',
            message: labelBase64
              ? 'Etiqueta gerada com sucesso via SDK!'
              : `SDK retornou resposta sem conteudo${labelData?.failure?.length ? ` (${labelData.failure.length} falha(s))` : ''}`,
            result: {
              loggiKey,
              hasLabel: !!labelBase64,
              labelBase64,
              labelLatencyMs: latencyMs,
              failures: labelData?.failure,
            },
            latencyMs,
            loggiApiResponse: labelData,
          },
        };
      } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        // SDK errors podem ter .data ou .status
        const sdkError = error as { status?: number; data?: unknown; message?: string };
        return {
          data: {
            success: false,
            type: 'label-sdk',
            message: sdkError.message || (error instanceof Error ? error.message : 'Erro desconhecido'),
            result: { loggiKey },
            latencyMs,
            loggiApiResponse: {
              status: sdkError.status,
              data: sdkError.data,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        };
      }
    }

    case 'tracking': {
      const trackCode = parsed.data.trackingCode;
      if (!trackCode) {
        throw new ApiError({
          code: 'VALIDATION_ERROR',
          message: 'trackingCode é obrigatório para rastreamento',
          status: 400,
        });
      }

      const startTime = Date.now();
      try {
        const trackingResponse = await getLoggiTracking(trackCode, { skipCircuitBreaker: true });
        const latencyMs = Date.now() - startTime;
        const pkg = trackingResponse.packages?.[0];

        return {
          data: {
            success: true,
            type: 'tracking',
            message: pkg?.status
              ? `Status: ${pkg.status.highLevelStatus} (code ${pkg.status.code}) — ${pkg.status.description}`
              : 'Resposta sem status',
            result: {
              trackingCode: trackCode,
              loggiKey: pkg?.loggiKey,
              status: pkg?.status,
              location: pkg?.location,
              promisedDate: pkg?.promisedDate,
              historyCount: pkg?.trackingHistory?.length || 0,
            },
            latencyMs,
            loggiApiResponse: trackingResponse,
          },
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const apiDetails = error instanceof LoggiApiError ? error.details : undefined;
        const errorCode = error instanceof LoggiApiError ? error.code : undefined;
        return {
          data: {
            success: false,
            type: 'tracking',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            result: { trackingCode: trackCode, apiErrorDetails: apiDetails },
            latencyMs,
            loggiApiResponse: {
              error: error instanceof Error ? error.message : String(error),
              errorCode,
              details: apiDetails,
            },
          },
        };
      }
    }

    case 'reset-cb': {
      const previousState = getLoggiCircuitBreakerState();
      resetLoggiCircuitBreaker();
      return {
        data: {
          success: true,
          type: 'reset-cb',
          message: `Circuit breaker resetado: ${previousState} → CLOSED`,
          result: { previousState, currentState: 'CLOSED' },
          latencyMs: 0,
        },
      };
    }
  }
});
