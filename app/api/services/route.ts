import { NextResponse } from "next/server";
import { shippingServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json({ services: shippingServices });
}
