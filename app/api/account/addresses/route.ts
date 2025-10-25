import { NextRequest, NextResponse } from "next/server";
import type { Address } from "@/types/account";

export const dynamic = "force-dynamic";

declare global {
  var __envioAddresses: Address[] | undefined;
}

function getAddressStore(): Address[] {
  if (!globalThis.__envioAddresses) {
    globalThis.__envioAddresses = [];
  }
  return globalThis.__envioAddresses;
}

function normalizeDefault(address: Address, store: Address[]) {
  if (!address.isDefault) return;
  globalThis.__envioAddresses = store.map((item) => ({
    ...item,
    isDefault: item.id === address.id,
  }));
}

export async function GET() {
  const addresses = getAddressStore();
  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Address>;
  const id = crypto.randomUUID();
  const address: Address = {
    id,
    label: body.label ?? "Endereço",
    cep: body.cep ?? "",
    logradouro: body.logradouro ?? "",
    numero: body.numero ?? "",
    complemento: body.complemento,
    bairro: body.bairro ?? "",
    cidade: body.cidade ?? "",
    uf: body.uf ?? "",
    isDefault: Boolean(body.isDefault),
  };

  const store = getAddressStore();
  store.push(address);
  normalizeDefault(address, store);

  return NextResponse.json({ ok: true, address });
}

export async function DELETE() {
  globalThis.__envioAddresses = [];
  return NextResponse.json({ ok: true });
}
