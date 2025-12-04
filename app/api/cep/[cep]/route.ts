import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  consultarCep,
  CepError,
  normalizeCep,
  isValidCep,
} from "@/lib/integrations/correios";

type CepRouteParams = Promise<{ cep: string }>;

/**
 * GET /api/cep/[cep]
 *
 * Consulta CEP usando a API oficial dos Correios como fonte primária,
 * com BrasilAPI como fallback em caso de indisponibilidade.
 *
 * @example
 * GET /api/cep/01310100
 * GET /api/cep/01310-100
 *
 * @returns {CepResult} Dados do endereço normalizado
 */
export async function GET(_request: NextRequest, context: { params: CepRouteParams }) {
  try {
    const { cep } = await context.params;

    // Normaliza e valida o CEP
    const digits = normalizeCep(cep);

    if (!isValidCep(digits)) {
      return NextResponse.json(
        { error: "CEP inválido. Deve conter 8 dígitos." },
        { status: 400 }
      );
    }

    // Consulta CEP usando Correios como primário com fallback automático
    const result = await consultarCep(digits);

    // Retorna no formato esperado pela aplicação
    return NextResponse.json({
      cep: result.cep,
      logradouro: result.logradouro,
      complemento: result.complemento,
      bairro: result.bairro,
      cidade: result.cidade,
      uf: result.uf,
      source: result.source, // Indica qual API retornou o resultado
    });
  } catch (error) {
    console.error('[GET /api/cep/[cep]] Error:', error);

    // Trata erros específicos do serviço de CEP
    if (error instanceof CepError) {
      const statusMap: Record<string, number> = {
        INVALID: 400,
        NOT_FOUND: 404,
        AUTH_ERROR: 503,
        SERVICE_UNAVAILABLE: 503,
      };

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao buscar CEP" },
      { status: 500 }
    );
  }
}
