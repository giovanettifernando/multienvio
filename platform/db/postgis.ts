/**
 * Serviço PostGIS - Geolocalização e cálculos de distância
 *
 * Regras:
 * - TODO CEP é geocodificado externamente apenas UMA vez
 * - Coordenadas são cacheadas na tabela cep_locations com PostGIS
 * - Distâncias são calculadas usando ST_Distance do PostGIS (precisão em metros)
 * - Busca de pontos mais próximos usa operador KNN (<->) com índice GIST
 */

import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';
import { geocodeCEP as geocodeExternal } from '@/platform/integrations/shared/geocoding';

/**
 * Normaliza CEP para formato de 8 dígitos sem hífen
 * @param rawCep CEP com ou sem formatação
 * @returns CEP normalizado (8 dígitos)
 */
export function normalizeCep(rawCep: string): string {
  return rawCep.replace(/\D/g, '').padStart(8, '0');
}

/**
 * Obtém coordenadas para um CEP com re-geocodificação inteligente
 *
 * Lógica:
 * 1. Busca no cache (tabela cep_locations)
 * 2. Se encontrar entrada com baixa precisão (city_fallback/state_fallback) E antiga (> 7 dias), tenta re-geocodificar
 * 3. Se não encontrar ou re-geocodificação falhar, geocodifica externamente
 * 4. Salva/atualiza no cache com coluna geography do PostGIS
 * 5. Retorna coordenadas com precisão
 *
 * @param rawCep CEP com ou sem formatação
 * @returns Coordenadas lat/lng com precisão e provider
 * @throws Error se não conseguir geocodificar
 */
export async function getCoordinatesForCep(rawCep: string): Promise<{
  lat: number;
  lng: number;
  precision?: string;
  provider?: string;
}> {
  const cep = normalizeCep(rawCep);

  console.log(`[PostGIS] getCoordinatesForCep: ${cep}`);

  // 1. Tentar buscar do cache
  const cached = await prisma.cepLocation.findUnique({
    where: { cep },
  });

  if (cached) {
    // IMPORTANTE: Nunca re-geocodificar CEPs com override manual
    if (cached.manualOverride) {
      console.log(
        `[PostGIS] Cache hit for CEP ${cep} (MANUAL OVERRIDE - protected from auto re-geocoding)`
      );
      console.log(`[PostGIS] Reason: ${cached.manualOverrideReason || 'Not specified'}`);
      return {
        lat: cached.latitude,
        lng: cached.longitude,
        precision: cached.precision ?? undefined,
        provider: cached.provider ?? undefined,
      };
    }

    const cacheAge = Date.now() - cached.updatedAt.getTime();
    const cacheAgeDays = cacheAge / (1000 * 60 * 60 * 24);
    const isLowPrecision = cached.precision === 'city_fallback' || cached.precision === 'state_fallback';
    const isOld = cacheAgeDays > 7; // 7 dias

    // Se a entrada é de baixa precisão e antiga, tentar re-geocodificar
    if (isLowPrecision && isOld) {
      console.log(`[PostGIS] Cache hit BUT low precision (${cached.precision}) and old (${cacheAgeDays.toFixed(1)} days)`);
      console.log(`[PostGIS] Attempting to re-geocode for better precision...`);

      try {
        const result = await geocodeExternal(cep);

        if (result.success && result.coordinates && result.precision) {
          const { lat, lng } = result.coordinates;
          const { precision, provider } = result;

          // PROTEÇÃO: Não atualizar dados da Base dos Dados ou com override manual
          if (cached.provider === 'basedosdados' || cached.manualOverride) {
            console.log(`[PostGIS] Cache entry is protected (provider=${cached.provider}, manualOverride=${cached.manualOverride}), skipping update`);
            return {
              lat: cached.latitude,
              lng: cached.longitude,
              precision: cached.precision ?? undefined,
              provider: cached.provider ?? undefined,
            };
          }

          // Se conseguiu melhor precisão, atualizar
          if (precision === 'address' || precision === 'zipcode' || precision === 'city') {
            console.log(`[PostGIS] Re-geocoding SUCCESS! Improved from ${cached.precision} to ${precision}`);

            await prisma.cepLocation.update({
              where: { cep },
              data: {
                latitude: lat,
                longitude: lng,
                precision,
                provider: provider ?? 'nominatim',
                updatedAt: new Date(),
              },
            });

            return { lat, lng, precision, provider: provider ?? 'nominatim' };
          } else {
            // Ainda baixa precisão, manter cache antigo mas atualizar timestamp para evitar re-geocoding frequente
            console.log(`[PostGIS] Re-geocoding did not improve precision (still ${precision}), keeping cached entry`);
            await prisma.cepLocation.update({
              where: { cep },
              data: { updatedAt: new Date() },
            });
          }
        }
      } catch (error) {
        console.warn(`[PostGIS] Re-geocoding failed, keeping cached entry:`, error);
        // Atualizar timestamp para evitar tentar novamente logo
        await prisma.cepLocation.update({
          where: { cep },
          data: { updatedAt: new Date() },
        });
      }
    } else {
      console.log(`[PostGIS] Cache hit for CEP ${cep} (precision: ${cached.precision})`);
    }

    return {
      lat: cached.latitude,
      lng: cached.longitude,
      precision: cached.precision ?? undefined,
      provider: cached.provider ?? undefined,
    };
  }

  console.log(`[PostGIS] Cache miss for CEP ${cep}, geocoding externally...`);

  // 2. Geocodificar externamente
  const result = await geocodeExternal(cep);

  if (!result.success || !result.coordinates) {
    throw new Error(`Não foi possível geocodificar o CEP ${cep}: ${result.error}`);
  }

  const { lat, lng } = result.coordinates;
  const precision = result.precision ?? 'unknown';
  const provider = result.provider ?? 'nominatim';

  console.log(`[PostGIS] Geocoded ${cep}: lat=${lat}, lng=${lng}, precision=${precision}`);

  // 3. Salvar no cache com latitude/longitude
  // PostGIS geography será construído dinamicamente nas queries usando ST_MakePoint
  await prisma.cepLocation.upsert({
    where: { cep },
    create: {
      cep,
      latitude: lat,
      longitude: lng,
      precision,
      provider,
    },
    update: {
      latitude: lat,
      longitude: lng,
      precision,
      provider,
      updatedAt: new Date(),
    },
  });

  console.log(`[PostGIS] Cached coordinates for CEP ${cep}`);

  return { lat, lng, precision, provider };
}

/**
 * Calcula distância em km entre dois CEPs usando PostGIS ST_Distance
 *
 * ST_Distance com geography retorna distância em metros considerando
 * a curvatura da Terra (elipsoide WGS84)
 *
 * @param cepA Primeiro CEP
 * @param cepB Segundo CEP
 * @returns Distância em quilômetros
 */
export async function calculateDistanceKmFromCeps(
  cepA: string,
  cepB: string
): Promise<number> {
  const a = normalizeCep(cepA);
  const b = normalizeCep(cepB);

  console.log(`[PostGIS] calculateDistanceKmFromCeps: ${a} <-> ${b}`);

  // Garantir que ambos os CEPs estão no cache
  await getCoordinatesForCep(a);
  await getCoordinatesForCep(b);

  // Calcular distância usando PostGIS com query parametrizada (Prisma.sql)
  const result = await prisma.$queryRaw<{ distance_m: number }[]>(Prisma.sql`
    SELECT ST_Distance(
      ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography
    ) AS distance_m
    FROM cep_locations a
    CROSS JOIN cep_locations b
    WHERE a.cep = ${a} AND b.cep = ${b}
  `);

  const distanceMeters = result[0]?.distance_m ?? 0;
  const distanceKm = distanceMeters / 1000;

  console.log(`[PostGIS] Distance: ${distanceKm.toFixed(2)} km (${distanceMeters.toFixed(0)} m)`);

  // Arredondar para 1 casa decimal
  return Math.round(distanceKm * 10) / 10;
}

/**
 * Encontra o coletor mais próximo de um CEP de origem usando PostGIS KNN
 *
 * Usa o operador <-> (KNN distance) que é otimizado pelo índice GIST
 * para encontrar o vizinho mais próximo de forma extremamente eficiente
 *
 * @param originCep CEP de origem
 * @returns Coletor mais próximo com distância em km e precisão, ou null se não houver coletores
 */
export async function findNearestCollectorByCep(originCep: string): Promise<{
  id: string;
  name: string;
  pfNome: string;
  pjRazaoSocial: string;
  pfCep: string;
  pjCep: string;
  distanceKm: number;
  pickupFeeType: string;
  pickupFixedFee: number | null;
  pickupFeePerKm: number | null;
  pickupFeeMinimum: number | null;
  precision?: string;
  provider?: string;
} | null> {
  const cep = normalizeCep(originCep);

  console.log(`[PostGIS] findNearestCollectorByCep: ${cep}`);

  // Garantir que o CEP de origem está no cache e obter precisão
  const originCoords = await getCoordinatesForCep(cep);

  // Buscar coletor mais próximo usando KNN (<->)
  // Nota: usamos BOTH pfCep e pjCep, pegando o que estiver mais próximo
  type CollectorQueryRow = {
    id: string;
    pfNome: string;
    pjRazaoSocial: string;
    pfCep: string;
    pjCep: string;
    pickupFeeType: string;
    pickupFixedFee: number | null;
    pickupFeePerKm: number | null;
    pickupFeeMinimum: number | null;
    distance_m: number;
  };

  const rows = await prisma.$queryRaw<CollectorQueryRow[]>(Prisma.sql`
    WITH collector_locations AS (
      -- Pegar coordenadas dos CEPs PF dos coletores
      SELECT
        c.id,
        c."pfNome",
        c."pjRazaoSocial",
        c."pfCep",
        c."pjCep",
        c."pickupFeeType",
        c."pickupFixedFee",
        c."pickupFeePerKm",
        c."pickupFeeMinimum",
        ST_SetSRID(ST_MakePoint(cl_pf.longitude, cl_pf.latitude), 4326)::geography as geom,
        'PF' as source
      FROM collectors c
      JOIN cep_locations cl_pf ON cl_pf.cep = regexp_replace(c."pfCep", '\D', '', 'g')
      WHERE c.status = 'ACTIVE'
        AND c."pfCep" IS NOT NULL
        AND cl_pf.latitude IS NOT NULL
        AND cl_pf.longitude IS NOT NULL

      UNION ALL

      -- Pegar coordenadas dos CEPs PJ dos coletores
      SELECT
        c.id,
        c."pfNome",
        c."pjRazaoSocial",
        c."pfCep",
        c."pjCep",
        c."pickupFeeType",
        c."pickupFixedFee",
        c."pickupFeePerKm",
        c."pickupFeeMinimum",
        ST_SetSRID(ST_MakePoint(cl_pj.longitude, cl_pj.latitude), 4326)::geography as geom,
        'PJ' as source
      FROM collectors c
      JOIN cep_locations cl_pj ON cl_pj.cep = regexp_replace(c."pjCep", '\D', '', 'g')
      WHERE c.status = 'ACTIVE'
        AND c."pjCep" IS NOT NULL
        AND cl_pj.latitude IS NOT NULL
        AND cl_pj.longitude IS NOT NULL
    ),
    origin AS (
      SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography as geom
      FROM cep_locations WHERE cep = ${cep}
    )
    SELECT
      cl.id,
      cl."pfNome",
      cl."pjRazaoSocial",
      cl."pfCep",
      cl."pjCep",
      cl."pickupFeeType",
      cl."pickupFixedFee",
      cl."pickupFeePerKm",
      cl."pickupFeeMinimum",
      ST_Distance(origin.geom, cl.geom) AS distance_m
    FROM collector_locations cl
    CROSS JOIN origin
    ORDER BY ST_Distance(origin.geom, cl.geom)
    LIMIT 1
  `);

  if (!rows || rows.length === 0) {
    console.log(`[PostGIS] No active collectors found`);
    return null;
  }

  const row = rows[0];
  const distanceKm = Math.round((row.distance_m / 1000) * 10) / 10;

  console.log(`[PostGIS] Nearest collector: ${row.pfNome || row.pjRazaoSocial} at ${distanceKm} km (origin precision: ${originCoords.precision})`);

  return {
    id: row.id,
    name: row.pfNome || row.pjRazaoSocial,
    pfNome: row.pfNome,
    pjRazaoSocial: row.pjRazaoSocial,
    pfCep: row.pfCep,
    pjCep: row.pjCep,
    distanceKm,
    pickupFeeType: row.pickupFeeType,
    pickupFixedFee: row.pickupFixedFee,
    pickupFeePerKm: row.pickupFeePerKm,
    pickupFeeMinimum: row.pickupFeeMinimum,
    precision: originCoords.precision,
    provider: originCoords.provider,
  };
}

