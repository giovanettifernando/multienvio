import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const exigeSeguro = Boolean(body?.seguro === undefined);
  const exigeDocumento = true;
  return NextResponse.json({
    selectionId: `sel-${nanoid(8)}`,
    exigeDocumento,
    exigeSeguro,
  });
}
