/**
 * Script para testar cálculo de distância
 */

import { calculateDistance } from '../lib/utils/geo';

// Coordenadas da capital PB (fallback usado pelo geocoding)
const capitalPB = { lat: -7.1195, lng: -34.845 };

// Coordenadas reais do coletor João Leonardo
const collectorCoords = { lat: -7.1215981, lng: -34.882028 };

console.log('Testing distance calculation:\n');
console.log('Capital PB coordinates:', capitalPB);
console.log('Collector coordinates:', collectorCoords);

const distance = calculateDistance(capitalPB, collectorCoords);
console.log('\nCalculated distance:', distance, 'km');

// Teste com coordenadas idênticas
const identical = calculateDistance(capitalPB, capitalPB);
console.log('Distance between identical coords:', identical, 'km');

// Teste com coordenadas bem diferentes (SP to PB)
const sp = { lat: -23.5505, lng: -46.6333 };
const distanceSPtoPB = calculateDistance(sp, capitalPB);
console.log('Distance SP to PB:', distanceSPtoPB, 'km');
