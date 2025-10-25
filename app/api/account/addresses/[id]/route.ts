import { NextRequest, NextResponse } from "next/server";
import { getAddressesStore } from "@/lib/api/stores";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as Record<string, unknown>;
  const addresses = getAddressesStore();
  const index = addresses.findIndex((item) => item.id === id);
  if (index < 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  addresses[index] = { ...addresses[index], ...body };
  if (addresses[index].isDefault) {
    addresses.forEach((address, idx) => {
      if (idx !== index) {
        address.isDefault = false;
      }
    });
  }
  return NextResponse.json({ ok: true, address: addresses[index] });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const addresses = getAddressesStore();
  const index = addresses.findIndex((item) => item.id === id);
  if (index < 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  addresses.splice(index, 1);
  return NextResponse.json({ ok: true });
}
