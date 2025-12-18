import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { geocodeCEP } from '@/platform/integrations/shared/geocoding';

type GeocodeResponse = {
  cep: string;
  coordinates: {
    lat: number;
    lng: number;
  };
};

/**
 * GET /api/geocode?cep=58035100
 * Geocodifica um CEP e retorna lat/lng
 */
export const GET = withApiHandler<GeocodeResponse>(async (context) => {
  const { searchParams } = new URL(context.req.url);
  const cep = searchParams.get('cep');

  if (!cep) {
    throw new ApiError({ code: 'validation_error', message: 'CEP é obrigatório', status: 400 });
  }

  const result = await geocodeCEP(cep);

  if (!result.success || !result.coordinates) {
    throw new ApiError({
      code: 'geocode_error',
      message: result.error || 'Erro ao geocodificar CEP',
      status: 400,
    });
  }

  return {
    data: {
      cep,
      coordinates: result.coordinates,
    },
  };
});
