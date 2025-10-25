import { NextResponse } from "next/server";
import { getWalletStore } from "@/lib/api/stores";

export const dynamic = "force-dynamic";

export async function GET() {
  const wallet = getWalletStore();
  return NextResponse.json(wallet);
}
