/**
 * Checkout Orchestrator
 * Handles atomic shipment + collection creation with idempotency
 */

import { useColetasStore } from "@/stores/coletas";
import type { ColetaOrigem } from "@/lib/coletas/types";

// Event broadcasting
const CHECKOUT_CHANNEL = "checkout-events-channel";
let checkoutBroadcast: BroadcastChannel | null = null;

if (typeof window !== "undefined") {
  checkoutBroadcast = new BroadcastChannel(CHECKOUT_CHANNEL);
}

interface CheckoutEventData {
  [key: string]: unknown;
}

function broadcastEvent(event: string, data: CheckoutEventData) {
  if (checkoutBroadcast) {
    checkoutBroadcast.postMessage({
      event,
      data,
      timestamp: Date.now(),
    });
  }
}

/**
 * Subscribe to checkout events
 */
export function subscribeCheckoutEvents(
  handler: (event: string, data: CheckoutEventData) => void
): () => void {
  if (typeof window === "undefined" || !checkoutBroadcast) return () => {};

  const listener = (event: MessageEvent) => {
    const { event: eventName, data } = event.data;
    handler(eventName, data);
  };

  checkoutBroadcast.addEventListener("message", listener);

  return () => {
    checkoutBroadcast?.removeEventListener("message", listener);
  };
}

// Idempotency tracking - in-memory for session
const processedCheckouts = new Map<string, { shipmentId: string; collectionId?: string }>();

interface CheckoutShipmentData {
  trackingCode: string;
  recipientName: string;
  recipientCityUf: string;
  carrierName: string;
  serviceName: string;
  etaDays: number;
  expectedDeliveryDate?: string;
  freightValue: number;
  status: string;
}

interface CheckoutCollectionData {
  origem: ColetaOrigem;
  transportadora: string | null;
  servico: string | null;
  janelaColeta?: string | null;
  observacoes?: string | null;
}

interface CheckoutResult {
  shipmentId: string;
  collectionId?: string;
  isDuplicate: boolean;
}

/**
 * Generate idempotency key from checkout context
 */
function generateIdempotencyKey(
  trackingCode: string,
  pickupRequested: boolean
): string {
  return `${trackingCode}-${pickupRequested ? "with-pickup" : "no-pickup"}`;
}

/**
 * Orchestrated checkout: creates shipment + optional collection atomically
 *
 * @param shipmentData - Shipment information
 * @param collectionData - Collection information (only if pickupRequested=true)
 * @param pickupRequested - Whether to create a collection
 * @returns CheckoutResult with IDs and duplicate flag
 */
export async function executeCheckout(
  shipmentData: CheckoutShipmentData,
  collectionData: CheckoutCollectionData | null,
  pickupRequested: boolean
): Promise<CheckoutResult> {
  const idempotencyKey = generateIdempotencyKey(
    shipmentData.trackingCode,
    pickupRequested
  );

  // Check if already processed (idempotency)
  const existing = processedCheckouts.get(idempotencyKey);
  if (existing) {
    console.log(`[Checkout] Idempotency hit for key: ${idempotencyKey}`);
    return {
      shipmentId: existing.shipmentId,
      collectionId: existing.collectionId,
      isDuplicate: true,
    };
  }

  // Step 1: Create Shipment (simulated - would call API in real implementation)
  const shipmentId = shipmentData.trackingCode;

  console.log(`[Checkout] Creating shipment: ${shipmentId}`);

  // Broadcast shipment_created event
  broadcastEvent("shipment_created", {
    shipmentId,
    carrierName: shipmentData.carrierName,
    serviceName: shipmentData.serviceName,
    recipientName: shipmentData.recipientName,
    status: shipmentData.status,
  });

  let collectionId: string | undefined;

  // Step 2: Create Collection if requested
  if (pickupRequested && collectionData) {
    console.log(`[Checkout] Creating collection for shipment: ${shipmentId}`);

    const coletasStore = useColetasStore.getState();

    // Check if collection already exists for this shipment
    const existingColeta = coletasStore.findByShipmentId(shipmentId);

    if (existingColeta) {
      console.log(
        `[Checkout] Collection already exists for shipment: ${shipmentId}, reusing`
      );
      collectionId = existingColeta.id;
    } else {
      // Create new collection
      const coleta = coletasStore.create({
        shipmentId,
        origem: collectionData.origem,
        transportadora: collectionData.transportadora,
        servico: collectionData.servico,
        janelaColeta: collectionData.janelaColeta || null,
        observacoes: collectionData.observacoes || null,
      });

      collectionId = coleta.id;

      // Broadcast collection_created event
      broadcastEvent("collection_created", {
        collectionId: coleta.id,
        shipmentId,
        status: coleta.status,
        origem: collectionData.origem,
      });
    }
  }

  // Store in idempotency map
  processedCheckouts.set(idempotencyKey, { shipmentId, collectionId });

  return {
    shipmentId,
    collectionId,
    isDuplicate: false,
  };
}

/**
 * Clear idempotency cache (useful for testing or after successful navigation away)
 */
export function clearCheckoutCache() {
  processedCheckouts.clear();
}
