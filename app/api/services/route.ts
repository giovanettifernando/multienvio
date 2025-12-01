import { NextResponse } from "next/server";
import { shippingServices } from "@/lib/services";


export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json({ services: shippingServices });
}
