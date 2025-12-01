import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { pickupPayloadSchema } from "@/lib/validation/pickup";
import { getShipmentStore, seedInitialShipments } from "@/lib/stores/shipments";
import type { Pickup, PickupEvent } from "@/types/pickup";
import type { StoredShipment } from "@/types/shipment";
import {
  getCompanyDisplayName,
  getCompanyDocument,
} from "@/lib/validation/company";


declare global {
  var __envioPickups: Map<string, Pickup> | undefined;
}

function getPickupStore(): Map<string, Pickup> {
  if (!globalThis.__envioPickups) {
    globalThis.__envioPickups = new Map();
  }
  return globalThis.__envioPickups;
}

function buildInitialEvent(): PickupEvent {
  return {
    id: `pke_${nanoid(10)}`,
    type: "REQUESTED",
    description: "Coleta solicitada",
    occurredAt: new Date().toISOString(),
  };
}

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const store = getPickupStore();
  return NextResponse.json({
    dados: Array.from(store.values()),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = pickupPayloadSchema.parse(payload);

    seedInitialShipments();
    const shipmentStore = getShipmentStore();
    const shipments = data.shipmentsIds
      .map((id: string) => shipmentStore.get(id))
      .filter(Boolean) as StoredShipment[];

    if (!shipments.length) {
      return NextResponse.json(
        { mensagem: "Envios inválidos" },
        { status: 400 },
      );
    }

    const totals = shipments.reduce(
      (acc, shipment) => {
        acc.count += 1;
        const peso = shipment.package?.pesoKg ?? 1;
        const volume = shipment.package
          ? (shipment.package.comprimentoCm ?? 20) *
            (shipment.package.larguraCm ?? 15) *
            (shipment.package.alturaCm ?? 10)
          : 1000;
        acc.weightKg += peso;
        acc.volumeCm3 += volume;
        return acc;
      },
      { count: 0, weightKg: 0, volumeCm3: 0 },
    );

    const company = globalThis.__envioCompany;

    if (!company) {
      return NextResponse.json(
        { mensagem: "Remetente não configurado" },
        { status: 400 },
      );
    }

    const pickup: Pickup = {
      id: `pck_${nanoid(10)}`,
      requestedAt: new Date().toISOString(),
      status: "REQUESTED",
      sender: {
        razao: getCompanyDisplayName(company),
        cnpj: company.tipoPessoa === "PJ" ? getCompanyDocument(company) : undefined,
        address: company.endereco,
        contact: {
          name: company.preferencias.remetente,
          phone: company.endereco.telefone,
        },
      },
      schedule: { ...data.schedule, notes: data.notes },
      carrierPref: data.carrierPref,
      shipments: shipments.map((shipment) => ({
        id: shipment.id,
        serviceCode: shipment.service.serviceCode,
        weightKg: shipment.package?.pesoKg ?? 1,
        to: {
          name: shipment.recipient.nome,
          cidade: shipment.recipient.cidade,
          uf: shipment.recipient.uf,
          cep: shipment.recipient.cep,
        },
      })),
      totals,
      events: [buildInitialEvent()],
    };

    const store = getPickupStore();
    store.set(pickup.id, pickup);

    return NextResponse.json(pickup, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          mensagem: "Dados inválidos",
          erros: error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensagem: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { mensagem: "Não foi possível criar a coleta" },
      { status: 500 },
    );
  }
}
