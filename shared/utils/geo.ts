/**
 * Utilidades de geolocalização e cálculo de distância
 */

/**
 * Coordenadas geográficas
 */
export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Coordenadas aproximadas de capitais brasileiras
 * Fonte: valores médios para centróides urbanos
 */
export const CAPITAL_COORDINATES: Record<string, GeoCoordinates> = {
  AC: { lat: -9.9757, lng: -67.8243 }, // Rio Branco
  AL: { lat: -9.6658, lng: -35.735 }, // Maceió
  AP: { lat: 0.034, lng: -51.0694 }, // Macapá
  AM: { lat: -3.119, lng: -60.0217 }, // Manaus
  BA: { lat: -12.9714, lng: -38.5014 }, // Salvador
  CE: { lat: -3.7172, lng: -38.5433 }, // Fortaleza
  DF: { lat: -15.7939, lng: -47.8828 }, // Brasília
  ES: { lat: -20.3155, lng: -40.3128 }, // Vitória
  GO: { lat: -16.6869, lng: -49.2648 }, // Goiânia
  MA: { lat: -2.5387, lng: -44.2825 }, // São Luís
  MT: { lat: -15.601, lng: -56.0974 }, // Cuiabá
  MS: { lat: -20.4697, lng: -54.6201 }, // Campo Grande
  MG: { lat: -19.9167, lng: -43.9345 }, // Belo Horizonte
  PA: { lat: -1.4558, lng: -48.4902 }, // Belém
  PB: { lat: -7.1195, lng: -34.845 }, // João Pessoa
  PR: { lat: -25.4284, lng: -49.2733 }, // Curitiba
  PE: { lat: -8.0476, lng: -34.877 }, // Recife
  PI: { lat: -5.0892, lng: -42.8019 }, // Teresina
  RJ: { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
  RN: { lat: -5.7945, lng: -35.211 }, // Natal
  RS: { lat: -30.0346, lng: -51.2177 }, // Porto Alegre
  RO: { lat: -8.7612, lng: -63.9004 }, // Porto Velho
  RR: { lat: 2.8235, lng: -60.6758 }, // Boa Vista
  SC: { lat: -27.5954, lng: -48.548 }, // Florianópolis
  SP: { lat: -23.5505, lng: -46.6333 }, // São Paulo
  SE: { lat: -10.9472, lng: -37.0731 }, // Aracaju
  TO: { lat: -10.1689, lng: -48.3317 }, // Palmas
};

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula distância geodésica entre dois pontos usando fórmula de Haversine
 * @param coord1 Primeira coordenada
 * @param coord2 Segunda coordenada
 * @returns Distância em quilômetros
 */
export function calculateDistance(
  coord1: GeoCoordinates,
  coord2: GeoCoordinates
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Arredondar para 1 casa decimal
}

/**
 * Obtém coordenadas aproximadas para uma UF
 * @param uf Sigla da UF
 * @returns Coordenadas da capital ou undefined
 */
export function getUFCoordinates(uf: string): GeoCoordinates | undefined {
  return CAPITAL_COORDINATES[uf.toUpperCase()];
}

/**
 * Formata distância para exibição
 * @param distanceKm Distância em quilômetros
 * @returns String formatada (ex: "15.2 km" ou "—")
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined || distanceKm === null) return '—';
  if (distanceKm < 1) return '< 1 km';
  return `${distanceKm.toFixed(1)} km`;
}
