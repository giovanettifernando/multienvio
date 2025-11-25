import type { OpsShipment, PointOfCollection, PickupOrder, OpsException, OpsEvent } from './types';

const STORAGE_KEY = 'admin.ops.seed';

interface OpsSeed {
  shipments: OpsShipment[];
  pocs: PointOfCollection[];
  pickups: PickupOrder[];
  exceptions: OpsException[];
  events: OpsEvent[];
}

// Generate initial seed data
function generateInitialSeed(): OpsSeed {
  const now = new Date();
  const shipments: OpsShipment[] = [];
  const customers = [
    'Tech Solutions Ltda', 'Loja Virtual XPTO', 'E-commerce ABC', 'Marketplace 123',
    'Distribuidora Sul', 'Fashion Store', 'Importadora XYZ', 'Eletrônicos Plus',
    'Atacado Premium', 'Varejo Online', 'Pet Shop Central', 'Farmácia Popular',
  ];
  const carriers: Array<'Correios' | 'Jadlog' | 'J&T' | 'Loggi' | null> = ['Correios', 'Jadlog', 'J&T', 'Loggi', null];
  const services = ['SEDEX', 'PAC', '.Package', 'Express', 'Standard', 'Same Day'];
  const statuses: Array<OpsShipment['status']> = [
    ...Array(16).fill('AWAITING_DROP_OFF_AT_POINT'),
    ...Array(12).fill('PICKUP_REQUESTED'),
    ...Array(8).fill('RECEIVED_AT_POINT'),
    ...Array(8).fill('IN_TRANSIT_TO_CARRIER'),
    ...Array(20).fill('IN_TRANSIT'),
    ...Array(8).fill('OUT_FOR_DELIVERY'),
    ...Array(6).fill('DELIVERED'),
    ...Array(2).fill('EXCEPTION'),
  ];

  // Generate 80 shipments
  for (let i = 0; i < 80; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const status = statuses[i % statuses.length];
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const weight = parseFloat((Math.random() * 5 + 0.5).toFixed(2));
    const declaredValue = parseFloat((Math.random() * 500 + 50).toFixed(2));

    shipments.push({
      id: `shp_${String(i + 1).padStart(3, '0')}`,
      platformTrackingCode: `EL${String(i + 1).padStart(9, '0')}`,
      carrierTrackingCode: carrier ? `${carrier.substring(0, 2).toUpperCase()}${String(i + 1).padStart(9, '0')}` : null,
      senderId: `cli_${String((i % 12) + 1).padStart(3, '0')}`,
      senderName: customers[i % customers.length],
      senderEmail: `contato${(i % 12) + 1}@email.com`,
      recipientId: null,
      recipientName: `Cliente ${i + 1}`,
      recipientPhone: `(11) 9${String(90000000 + i).substring(0, 8)}`,
      recipientEmail: null,
      recipientDocument: null,
      destinationAddress: `Rua ${i + 1}, ${(i + 1) * 10}`,
      destinationNeighborhood: 'Centro',
      destinationCity: 'São Paulo',
      destinationState: 'SP',
      destinationCep: `01${String(i + 1).padStart(3, '0')}-000`,
      originCep: `05${String(i + 1).padStart(3, '0')}-000`,
      weight,
      declaredValue,
      status,
      carrier,
      service: carrier ? services[Math.floor(Math.random() * services.length)] : null,
      estimatedDays: carrier ? Math.floor(Math.random() * 5 + 1) : null,
      freightCost: carrier ? parseFloat((Math.random() * 50 + 10).toFixed(2)) : null,
      pickupFee: Math.random() < 0.5 ? parseFloat((Math.random() * 10 + 5).toFixed(2)) : null,
      pickupPointId: null,
      pickupPointName: null,
      collectorId: null,
      collectorName: null,
      postedAt: null,
      receivedAt: null,
      receivedBy: null,
      deliveredAt: status === 'DELIVERED' ? new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      createdAt: createdAt.toISOString(),
      updatedAt: new Date(createdAt.getTime() + Math.random() * 48 * 60 * 60 * 1000).toISOString(),
      pickupRequestId: null,
      pickupRequestStatus: null,
      pickupScheduledAt: null,
      pickupCollectedAt: null,
      pickupDeliveredToCarrierAt: null,
      labelStatus: null,
      labelFileUrl: null,
      labelIsPrinted: false,
      packageCount: 1,
      hasDivergence: false,
    });
  }

  // Generate 10 PoCs
  const pocs: PointOfCollection[] = Array.from({ length: 10 }, (_, i) => ({
    id: `poc_${String(i + 1).padStart(3, '0')}`,
    name: `Ponto de Coleta ${['Centro', 'Vila Mariana', 'Pinheiros', 'Mooca', 'Tatuapé', 'Santana', 'Lapa', 'Butantã', 'Ipiranga', 'Penha'][i]}`,
    code: `POC-${String(i + 1).padStart(3, '0')}`,
    address: `Rua ${i + 1}, ${(i + 1) * 100} - São Paulo/SP`,
    city: 'São Paulo',
    state: 'SP',
    contact: `(11) ${90000 + i * 1000}-${String(i * 111).padStart(4, '0')}`,
    active: Math.random() < 0.9,
    commissionPerItem: parseFloat((Math.random() * 3 + 1).toFixed(2)),
    capacityDaily: Math.floor(Math.random() * 100 + 50),
    itemsAwaiting: Math.floor(Math.random() * 30),
    itemsReceivedToday: Math.floor(Math.random() * 20),
    monthlyReceived: Math.floor(Math.random() * 300 + 50), // 50-350 items per month
  }));

  // Generate 12 pickups
  const pickups: PickupOrder[] = Array.from({ length: 12 }, (_, i) => {
    const scheduleDate = new Date(now.getTime() + (i - 6) * 24 * 60 * 60 * 1000);
    const type = i % 3 === 0 ? 'poc_pickup' : 'home_pickup';
    return {
      id: `pck_${String(i + 1).padStart(3, '0')}`,
      type,
      provider: Math.random() < 0.6 ? 'internal' : 'third',
      scheduledFor: scheduleDate.toISOString(),
      window: { start: '09:00', end: '12:00' },
      address: type === 'poc_pickup' ? `PoC ${i + 1}` : `Rua ${i + 1}, ${(i + 1) * 10} - São Paulo/SP`,
      pocId: type === 'poc_pickup' ? `poc_${String((i % 10) + 1).padStart(3, '0')}` : null,
      pocName: type === 'poc_pickup' ? `Ponto ${i + 1}` : null,
      capacitySlots: Math.floor(Math.random() * 20 + 5),
      status: ['scheduled', 'en_route', 'completed', 'failed'][Math.floor(Math.random() * 4)] as PickupOrder['status'],
      vehicle: Math.random() < 0.7 ? `VAN-${String(i + 1).padStart(3, '0')}` : null,
      driver: Math.random() < 0.7 ? ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Lima'][i % 4] : null,
    };
  });

  // Generate 15 exceptions
  const exceptionTypes: Array<OpsException['type']> = [
    'address_issue', 'not_found', 'damage', 'missing_docs',
    'pickup_failed', 'poc_over_capacity', 'carrier_delay',
  ];
  const exceptions: OpsException[] = Array.from({ length: 15 }, (_, i) => ({
    id: `exc_${String(i + 1).padStart(3, '0')}`,
    shipmentId: `shp_${String(Math.floor(Math.random() * 80) + 1).padStart(3, '0')}`,
    createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    type: exceptionTypes[i % exceptionTypes.length],
    description: `Exceção ${i + 1} - ${exceptionTypes[i % exceptionTypes.length]}`,
    severity: (['low', 'medium', 'high'][Math.floor(Math.random() * 3)]) as OpsException['severity'],
    status: (['open', 'in_progress', 'resolved'][Math.floor(Math.random() * 3)]) as OpsException['status'],
    lastUpdate: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: Math.random() < 0.5 ? ['João', 'Maria', 'Pedro'][Math.floor(Math.random() * 3)] : null,
    notes: Math.random() < 0.5 ? 'Em acompanhamento' : null,
  }));

  // Generate 50 events
  const sources: Array<OpsEvent['source']> = ['carrier_webhook', 'poc_checkin', 'pickup_scan', 'manual'];
  const events: OpsEvent[] = Array.from({ length: 50 }, (_, i) => ({
    id: `evt_${String(i + 1).padStart(3, '0')}`,
    source: sources[i % sources.length],
    receivedAt: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
    shipmentId: Math.random() < 0.8 ? `shp_${String(Math.floor(Math.random() * 80) + 1).padStart(3, '0')}` : null,
    payloadPreview: `Event ${i + 1} - ${sources[i % sources.length]}`,
    processed: i >= 25,
    retries: Math.floor(Math.random() * 3),
    lastError: i < 25 && Math.random() < 0.3 ? 'Timeout na integração' : null,
  }));

  return { shipments, pocs, pickups, exceptions, events };
}

// Get seed from localStorage or generate new one
export function getSeed(): OpsSeed {
  if (typeof window === 'undefined') return generateInitialSeed();

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid data, regenerate
    }
  }

  const seed = generateInitialSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

// Save seed to localStorage
export function saveSeed(seed: OpsSeed): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
}

// Update specific parts of the seed
export function updateShipments(updater: (shipments: OpsShipment[]) => OpsShipment[]): void {
  const seed = getSeed();
  seed.shipments = updater(seed.shipments);
  saveSeed(seed);
}

export function updatePoCs(updater: (pocs: PointOfCollection[]) => PointOfCollection[]): void {
  const seed = getSeed();
  seed.pocs = updater(seed.pocs);
  saveSeed(seed);
}

export function updatePickups(updater: (pickups: PickupOrder[]) => PickupOrder[]): void {
  const seed = getSeed();
  seed.pickups = updater(seed.pickups);
  saveSeed(seed);
}

export function updateExceptions(updater: (exceptions: OpsException[]) => OpsException[]): void {
  const seed = getSeed();
  seed.exceptions = updater(seed.exceptions);
  saveSeed(seed);
}

export function updateEvents(updater: (events: OpsEvent[]) => OpsEvent[]): void {
  const seed = getSeed();
  seed.events = updater(seed.events);
  saveSeed(seed);
}
