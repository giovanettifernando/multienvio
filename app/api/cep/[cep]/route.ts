import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import {
  consultarCep,
  CepError,
  normalizeCep,
  isValidCep,
} from "@/platform/integrations/correios";

type CepResponse = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  source: string;
};

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
export const GET = withApiHandler<CepResponse, { cep: string }>(async (context) => {
  const cep = context.params.cep;

  // Normaliza e valida o CEP
  const digits = normalizeCep(cep);

  if (!isValidCep(digits)) {
    throw new ApiError({
      code: 'invalid_cep',
      message: 'CEP inválido. Deve conter 8 dígitos.',
      status: 400,
    });
  }

  try {
    // Consulta CEP usando Correios como primário com fallback automático
    const result = await consultarCep(digits);

    // Retorna no formato esperado pela aplicação
    return {
      data: {
        cep: result.cep,
        logradouro: result.logradouro,
        complemento: result.complemento,
        bairro: result.bairro,
        cidade: result.cidade,
        uf: result.uf,
        source: result.source, // Indica qual API retornou o resultado
      },
    };
  } catch (error) {
    // Trata erros específicos do serviço de CEP
    if (error instanceof CepError) {
      const statusMap: Record<string, number> = {
        INVALID: 400,
        NOT_FOUND: 404,
        AUTH_ERROR: 503,
        SERVICE_UNAVAILABLE: 503,
      };

      throw new ApiError({
        code: error.code.toLowerCase(),
        message: error.message,
        status: statusMap[error.code] || 500,
      });
    }

    throw error;
  }
});
