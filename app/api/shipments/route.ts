import { NextRequest, NextResponse } from "next/server";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";

declare global {
  var __envioShipmentsStore: Shipment[] | undefined;
}

const getStore = (): Shipment[] => {
  if (!globalThis.__envioShipmentsStore) {
    globalThis.__envioShipmentsStore = [];
  }
  return globalThis.__envioShipmentsStore;
};

const setStore = (items: Shipment[]) => {
  globalThis.__envioShipmentsStore = items;
};

const matchesQuery = (shipment: Shipment, term: string) => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return [
    shipment.id,
    shipment.trackingCode,
    shipment.recipientName,
    shipment.recipientCityUf,
    shipment.carrierName,
    shipment.serviceName,
    shipment.createdAt,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .some((value) => value.includes(normalized));
};

const matchesStatus = (shipment: Shipment, status?: ShipmentStatus | "Todos") => {
  if (!status || status === "Todos") return true;
  return shipment.status === status;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusParam = (searchParams.get("status") as ShipmentStatus | "Todos" | null) ?? "Todos";

  const filtered = getStore().filter(
    (item) => matchesQuery(item, q) && matchesStatus(item, statusParam ?? undefined),
  );

  return NextResponse.json({ items: filtered });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const now = new Date();
  const etaDays = Number(body.etaDays ?? 0);
  const expectedDeliveryDate = body.expectedDeliveryDate
    ? new Date(body.expectedDeliveryDate).toISOString()
    : etaDays > 0
      ? new Date(now.getTime() + etaDays * 86_400_000).toISOString()
      : undefined;

  const shipment: Shipment = {
    id: crypto.randomUUID(),
    trackingCode: body.trackingCode ?? `BR${Date.now()}BR`,
    recipientName: body.recipientName ?? "Destinatário",
    recipientCityUf: body.recipientCityUf ?? "Cidade/UF",
    carrierName: body.carrierName ?? body.serviceName ?? "Transportadora",
    serviceName: body.serviceName ?? "Serviço",
    etaDays,
    expectedDeliveryDate,
    freightValue: Number(body.freightValue ?? 0),
    status: (body.status as ShipmentStatus) ?? "Aguardando coleta",
    createdAt: now.toISOString(),
    labelUrl: body.labelUrl ?? undefined,
    trackingUrl: body.trackingUrl ?? undefined,
  };

  setStore([shipment, ...getStore()]);
  return NextResponse.json({ ok: true, shipment });
}
