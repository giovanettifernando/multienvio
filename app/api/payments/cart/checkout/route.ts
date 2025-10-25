import { NextResponse } from "next/server";

export async function POST() {
  // Em produção, processe pagamento e gere labels/trackings.
  // Aqui só retorna ok.
  return NextResponse.json({ ok: true, labels: [] });
}

