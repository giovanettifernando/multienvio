/**
 * Serviço para gerenciar a tabela cep_locations
 *
 * Permite:
 * - Forçar re-geocodificação de CEPs problemáticos
 * - Correção manual de coordenadas
 * - Prevenir re-geocoding automático de CEPs corrigidos manualmente
 */

import prisma from '@/lib/db';
import { geocodeCEP } from '@/lib/services/geocoding';

/**
 * Normaliza CEP removendo traços, espaços e caracteres especiais
 */
function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Força re-geocodificação de um CEP específico
 *
 * Este método:
 * 1. Apaga a entrada atual do CEP em cep_locations (se existir)
 * 2. Chama o fluxo de geocoding novamente (cache miss forçado)
 * 3. Persiste o novo resultado
 *
 * IMPORTANTE: Não use este método em CEPs com manualOverride=true,
 * pois isso apagaria a correção manual.
 *
 * @param rawCep CEP a ser re-geocodificado (com ou sem formatação)
 * @returns Novo registro de cep_locations
 * @throws Error se o geocoding falhar
 */
export async function forceRegeocodeCep(rawCep: string) {
  const cep = normalizeCep(rawCep);

  console.log(`[CEP_LOCATION] Forçando re-geocodificação para CEP ${cep}`);

  // 1. Verificar se existe e se tem override manual
  const existing = await prisma.cepLocation.findUnique({
    where: { cep },
  });

  if (existing?.manualOverride) {
    throw new Error(
      `CEP ${cep} tem correção manual (manualOverride=true). ` +
        `Não é permitido re-geocodificar automaticamente. ` +
        `Motivo: ${existing.manualOverrideReason || 'Não especificado'}`
    );
  }

  // PROTEÇÃO: Dados da Base dos Dados são READ-ONLY
  if (existing?.provider === 'basedosdados') {
    throw new Error(
      `CEP ${cep} tem dados da Base dos Dados (provider=basedosdados). ` +
        `Estes dados são protegidos e não podem ser re-geocodificados. ` +
        `Use updateCepManual() para criar um override manual se necessário.`
    );
  }

  // 2. Apagar entrada atual (se existir)
  if (existing) {
    console.log(`[CEP_LOCATION] Apagando entrada existente (precisão: ${existing.precision})`);
    await prisma.cepLocation.delete({
      where: { cep },
    });
  }

  // 3. Chamar o geocoding novamente
  console.log(`[CEP_LOCATION] Chamando geocoding externo...`);

  const result = await geocodeCEP(cep);

  if (!result.success || !result.coordinates) {
    throw new Error(
      `Falha ao geocodificar CEP ${cep}: ${result.error || 'Coordenadas não encontradas'}`
    );
  }

  // 4. Persistir novo resultado
  const newEntry = await prisma.cepLocation.create({
    data: {
      cep,
      latitude: result.coordinates.lat,
      longitude: result.coordinates.lng,
      precision: result.precision || 'unknown',
      provider: result.provider || 'nominatim',
      manualOverride: false,
      manualOverrideReason: null,
    },
  });

  console.log(
    `[CEP_LOCATION] ✅ CEP re-geocodificado com sucesso. ` +
      `Precisão: ${newEntry.precision}, ` +
      `Coordenadas: ${newEntry.latitude}, ${newEntry.longitude}`
  );

  return newEntry;
}

/**
 * Atualiza coordenadas de um CEP manualmente
 *
 * Este método:
 * 1. Insere ou atualiza o CEP em cep_locations
 * 2. Define manualOverride=true para prevenir re-geocoding automático
 * 3. Registra o motivo da correção manual
 *
 * Use este método quando:
 * - O geocoding automático retornar coordenadas incorretas
 * - Você obteve coordenadas precisas de outra fonte (Google Maps, etc.)
 * - Precisa corrigir CEPs com state_fallback ou city_fallback
 *
 * @param rawCep CEP a ser corrigido
 * @param lat Latitude correta
 * @param lng Longitude correta
 * @param precision Nível de precisão ('address', 'zipcode', 'city', 'manual')
 * @param motivo Motivo da correção manual
 * @returns Registro atualizado de cep_locations
 */
export async function updateCepManual(
  rawCep: string,
  lat: number,
  lng: number,
  precision: string = 'manual',
  motivo?: string
) {
  const cep = normalizeCep(rawCep);

  console.log(`[CEP_LOCATION] Atualizando CEP ${cep} manualmente`);
  console.log(`[CEP_LOCATION] Coordenadas: ${lat}, ${lng}`);
  console.log(`[CEP_LOCATION] Precisão: ${precision}`);
  console.log(`[CEP_LOCATION] Motivo: ${motivo || 'Não especificado'}`);

  // Validar coordenadas
  if (!isFinite(lat) || !isFinite(lng)) {
    throw new Error('Coordenadas inválidas: lat e lng devem ser números finitos');
  }

  if (lat < -90 || lat > 90) {
    throw new Error(`Latitude inválida: ${lat} (deve estar entre -90 e 90)`);
  }

  if (lng < -180 || lng > 180) {
    throw new Error(`Longitude inválida: ${lng} (deve estar entre -180 e 180)`);
  }

  // Validar se está no Brasil (aproximadamente)
  const dentroDoBrasil = lat >= -35 && lat <= 6 && lng >= -75 && lng <= -33;
  if (!dentroDoBrasil) {
    console.warn(
      `[CEP_LOCATION] ⚠️  Coordenadas fora do Brasil: ${lat}, ${lng}. Verifique se está correto.`
    );
  }

  // Upsert (insert ou update)
  const updated = await prisma.cepLocation.upsert({
    where: { cep },
    create: {
      cep,
      latitude: lat,
      longitude: lng,
      precision,
      provider: 'manual',
      manualOverride: true,
      manualOverrideReason: motivo || 'Correção manual de coordenadas',
    },
    update: {
      latitude: lat,
      longitude: lng,
      precision,
      provider: 'manual',
      manualOverride: true,
      manualOverrideReason: motivo || 'Correção manual de coordenadas',
      updatedAt: new Date(),
    },
  });

  console.log(
    `[CEP_LOCATION] ✅ CEP ${cep} atualizado manualmente. ` +
      `Registro protegido contra re-geocoding automático.`
  );

  return updated;
}

/**
 * Remove a flag de override manual de um CEP
 *
 * Permite que o CEP seja re-geocodificado automaticamente no futuro.
 *
 * @param rawCep CEP a ter o override removido
 * @returns Registro atualizado
 */
export async function removeCepManualOverride(rawCep: string) {
  const cep = normalizeCep(rawCep);

  console.log(`[CEP_LOCATION] Removendo override manual do CEP ${cep}`);

  const updated = await prisma.cepLocation.update({
    where: { cep },
    data: {
      manualOverride: false,
      manualOverrideReason: null,
      updatedAt: new Date(),
    },
  });

  console.log(`[CEP_LOCATION] ✅ Override manual removido. CEP pode ser re-geocodificado.`);

  return updated;
}

/**
 * Busca um CEP em cep_locations
 *
 * @param rawCep CEP a ser buscado
 * @returns Registro ou null se não encontrado
 */
export async function getCepLocation(rawCep: string) {
  const cep = normalizeCep(rawCep);
  return prisma.cepLocation.findUnique({ where: { cep } });
}

/**
 * Lista todos os CEPs com override manual
 *
 * @returns Array de registros com manualOverride=true
 */
export async function listManualOverrides() {
  return prisma.cepLocation.findMany({
    where: { manualOverride: true },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Lista CEPs com baixa precisão (state_fallback, city_fallback)
 *
 * @returns Array de registros com precisão ruim
 */
export async function listLowPrecisionCeps() {
  return prisma.cepLocation.findMany({
    where: {
      precision: {
        in: ['state_fallback', 'city_fallback'],
      },
      manualOverride: false, // Excluir CEPs já corrigidos manualmente
    },
    orderBy: { updatedAt: 'desc' },
  });
}
