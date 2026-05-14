// app/api/admin/integrations/total-express/test/route.ts

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { testTEAuth } from '@/platform/integrations/total-express/client';
import { cotarTE } from '@/platform/integrations/total-express/cotacao';
import { createTEOrder } from '@/platform/integrations/total-express/order';
import { getTETracking } from '@/platform/integrations/total-express/tracking';
import { TEApiError } from '@/platform/integrations/total-express/types';

const testSchema = z.object({
  type: z.enum(['auth', 'quote', 'order', 'tracking']),
  cepOrigem: z.string().optional(),
  cepDestino: z.string().optional(),
  pesoKg: z.number().optional(),
  comprimentoCm: z.number().optional(),
  larguraCm: z.number().optional(),
  alturaCm: z.number().optional(),
  valorDeclarado: z.number().optional(),
  awb: z.string().optional(),
  orderData: z.object({
    tipoServico: z.string(),
    numeroPedido: z.string().optional(),
    remetente: z.object({
      nome: z.string(),
      cnpjCpf: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      bairro: z.string(),
      cep: z.string(),
      cidade: z.string(),
      uf: z.string(),
      telefone: z.string().optional(),
    }),
    destinatario: z.object({
      nome: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      bairro: z.string(),
      cep: z.string(),
      cidade: z.string(),
      uf: z.string(),
      telefone: z.string().optional(),
    }),
    pesoKg: z.number(),
    comprimentoCm: z.number(),
    larguraCm: z.number(),
    alturaCm: z.number(),
  }).optional(),
});

export const POST = withApiHandler<Record<string, unknown>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', status: 400, details: parsed.error.flatten() });
  }

  const { type } = parsed.data;

  switch (type) {
    case 'auth': {
      const result = await testTEAuth();
      return {
        data: {
          success: result.success,
          type: 'auth',
          message: result.message,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
    }

    case 'quote': {
      const { cepOrigem, cepDestino, pesoKg } = parsed.data;
      if (!cepOrigem || !cepDestino || !pesoKg) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'cepOrigem, cepDestino e pesoKg são obrigatórios', status: 400 });
      }

      const startTime = Date.now();
      try {
        const cotacoes = await cotarTE({
          cepOrigem,
          cepDestino,
          pesoG: Math.round(pesoKg * 1000),
          comprimentoCm: parsed.data.comprimentoCm || 20,
          larguraCm: parsed.data.larguraCm || 15,
          alturaCm: parsed.data.alturaCm || 10,
          valorDeclaradoCentavos: parsed.data.valorDeclarado ? Math.round(parsed.data.valorDeclarado * 100) : undefined,
        });

        return {
          data: {
            success: true,
            type: 'quote',
            message: `${cotacoes.length} opção(ões) encontradas`,
            result: { cotacoes },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'quote',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
            error: error instanceof TEApiError ? { code: error.code, message: error.apiMessage } : undefined,
          },
        };
      }
    }

    case 'order': {
      const orderData = parsed.data.orderData;
      if (!orderData) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'orderData é obrigatório', status: 400 });
      }

      const startTime = Date.now();
      try {
        const response = await createTEOrder({
          tipoServico: orderData.tipoServico,
          numeroPedido: orderData.numeroPedido,
          remetente: orderData.remetente,
          destinatario: orderData.destinatario,
          volumes: [{
            pesoKg: orderData.pesoKg,
            comprimentoCm: orderData.comprimentoCm,
            larguraCm: orderData.larguraCm,
            alturaCm: orderData.alturaCm,
          }],
        });

        const awb = response.awb || response.volumes?.[0]?.awb;
        return {
          data: {
            success: response.status === 0 || !!awb,
            type: 'order',
            message: awb ? `Pedido criado. AWB: ${awb}` : `Status: ${response.status} — ${response.mensagem || ''}`,
            result: { awb, response },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'order',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
          },
        };
      }
    }

    case 'tracking': {
      const { awb } = parsed.data;
      if (!awb) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'awb é obrigatório', status: 400 });
      }

      const startTime = Date.now();
      try {
        const response = await getTETracking(awb);
        const pkg = response.encomendas?.[0];
        return {
          data: {
            success: true,
            type: 'tracking',
            message: pkg?.statusAtual ? `Status: ${pkg.statusAtual}` : 'Resposta sem status',
            result: { awb, pkg, eventCount: pkg?.eventos?.length || 0 },
            latencyMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          data: {
            success: false,
            type: 'tracking',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
          },
        };
      }
    }
  }
});
