import { NextResponse } from "next/server";
import type { TrackingEventType } from "@/types/tracking";
import {
  ensureTracking,
  type TrackingEvent,
  type TrackingPayload,
} from "@/lib/api/tracking";

export const dynamic = "force-dynamic";

const carrierMap: Record<string, TrackingEventType> = {
  CREATED: "CREATED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELAYED: "DELAYED",
  ISSUE: "ISSUE",
};

export async function POST(request: Request) {
  const payload = await request.json();
  const shipmentId = payload?.shipmentId as string;
  const carrierCode = payload?.code as string;
  const description = payload?.description as string;
  const city = payload?.city as string | undefined;
  const uf = payload?.uf as string | undefined;
  const occurredAt = payload?.occurredAt as string | undefined;

  if (!shipmentId || !carrierCode || !description) {
    return NextResponse.json(
      { mensagem: "shipmentId, code e description são obrigatórios" },
      { status: 400 },
    );
  }

  const type = carrierMap[carrierCode] ?? "IN_TRANSIT";

  await new Promise((resolve) => setTimeout(resolve, 200));

  const tracking = ensureTracking(shipmentId);

  const normalizedEvent: TrackingEvent = {
    code: type,
    description,
    at: occurredAt ?? new Date().toISOString(),
    location: [city, uf].filter(Boolean).join(" - ") || "—",
  };

  tracking.events = [normalizedEvent, ...tracking.events];

  const statusMap: Record<string, TrackingPayload["status"]> = {
    DELIVERED: "delivered",
    DELAYED: "delayed",
  };
  tracking.status = statusMap[normalizedEvent.code] ?? "in_transit";

  return NextResponse.json(tracking);
}
