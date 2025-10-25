import { NextRequest, NextResponse } from "next/server";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";

declare global {
  var __envioShipmentsStore: Shipment[] | undefined;
}

const getStore = (): Shipment[] => globalThis.__envioShipmentsStore ?? [];
const setStore = (items: Shipment[]) => {
  globalThis.__envioShipmentsStore = items;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const index = store.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ mensagem: "Envio não encontrado" }, { status: 404 });
  }

  const updated: Shipment = {
    ...store[index],
    status: "Cancelado" as ShipmentStatus,
  };

  const next = [...store];
  next[index] = updated;
  setStore(next);

  return NextResponse.json({ ok: true, shipment: updated });
}
