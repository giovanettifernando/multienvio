import { NextRequest, NextResponse } from "next/server";
import type { Pickup, PickupStatus } from "@/types/pickup";

export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __pickups: Map<string, Pickup> | undefined;
}

function getPickupStore(): Map<string, Pickup> {
  if (!globalThis.__pickups) {
    globalThis.__pickups = new Map();
  }
  return globalThis.__pickups;
}

// GET /api/pickups/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const store = getPickupStore();
  const pickup = store.get(id);
  if (!pickup) {
    return NextResponse.json(
      { mensagem: "Coleta não encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json(pickup);
}

// PATCH /api/pickups/[id]
// aceita { status?: PickupStatus; notes?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await request.json();

  const store = getPickupStore();
  const pickup = store.get(id);
  if (!pickup) {
    return NextResponse.json(
      { mensagem: "Coleta não encontrada" },
      { status: 404 },
    );
  }

  let changed = false;

  if (typeof payload.notes === "string") {
    pickup.schedule = {
      ...pickup.schedule,
      notes: payload.notes,
    };
    changed = true;
  }

  if (payload.status) {
    const next = payload.status as PickupStatus;

    if (next !== pickup.status) {
      pickup.status = next;
      // registra evento simples
      pickup.events.unshift({
        id: `pku_evt_${Math.random().toString(36).slice(2, 10)}`,
        type: next,
        description:
          next === "PICKED_UP"
            ? "Coleta realizada"
            : next === "SCHEDULED"
            ? "Coleta agendada"
            : next === "ASSIGNED"
            ? "Motorista atribuído"
            : next === "FAILED"
            ? "Falha na coleta"
            : next === "CANCELED"
            ? "Coleta cancelada"
            : "Atualização de status",
        occurredAt: new Date().toISOString(),
      });
      changed = true;
    }
  }

  if (changed) {
    store.set(id, pickup);
  }

  return NextResponse.json(pickup);
}
