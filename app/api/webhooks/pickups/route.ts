import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Pickup, PickupStatus } from "@/types/pickup";

export const dynamic = "force-dynamic";

declare global {
  var __envioPickups: Map<string, Pickup> | undefined;
}

function getPickupStore(): Map<string, Pickup> {
  if (!globalThis.__envioPickups) {
    globalThis.__envioPickups = new Map();
  }
  return globalThis.__envioPickups;
}

const statusMap: Record<string, PickupStatus> = {
  scheduled: "SCHEDULED",
  assigned: "ASSIGNED",
  picked_up: "PICKED_UP",
  failed: "FAILED",
  canceled: "CANCELED",
};

export async function POST(request: Request) {
  const payload = await request.json();
  const pickupId = payload?.pickupId as string;
  const code = payload?.code as string;
  const description = payload?.description as string;
  const occurredAt = payload?.occurredAt as string | undefined;

  if (!pickupId || !code) {
    return NextResponse.json(
      { mensagem: "pickupId e code são obrigatórios" },
      { status: 400 },
    );
  }

  const store = getPickupStore();
  const pickup = store.get(pickupId);

  if (!pickup) {
    return NextResponse.json(
      { mensagem: "Coleta não encontrada" },
      { status: 404 },
    );
  }

  const mapped = statusMap[code] ?? "NOTE";
  pickup.events = [
    {
      id: `pke_${nanoid(10)}`,
      type: mapped,
      description: description ?? `Webhook: ${code}`,
      occurredAt: occurredAt ?? new Date().toISOString(),
    },
    ...pickup.events,
  ];

const isNote = (payload.code?.toUpperCase() ?? "") === "NOTE";
if (!isNote) {
  pickup.status = mapped; // mapped é PickupStatus, ok aqui
}
  store.set(pickup.id, pickup);

  return NextResponse.json(pickup);
}
