import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Pickup } from "@/types/pickup";

export const dynamic = "force-dynamic";

declare global {
  var __pickups: Map<string, Pickup> | undefined;
}

function getPickupStore(): Map<string, Pickup> {
  if (!globalThis.__pickups) {
    globalThis.__pickups = new Map();
  }
  return globalThis.__pickups;
}

// POST /api/pickups/[id]/manifest
export async function POST(
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

  const manifestId = `mft_${nanoid(8)}`;
  const pdfUrl = `/mock/manifests/${manifestId}.pdf`;
  const generatedAt = new Date().toISOString();

  pickup.manifest = { id: manifestId, pdfUrl, generatedAt };
  store.set(id, pickup);

  return NextResponse.json(pickup.manifest);
}
