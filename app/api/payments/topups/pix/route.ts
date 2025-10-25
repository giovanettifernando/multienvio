import { NextRequest, NextResponse } from "next/server";
import { pushTx, getWalletStore } from "@/lib/api/stores";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { mensagem: "Informe um valor válido." },
      { status: 400 },
    );
  }

  const transaction = pushTx({
    type: "TOPUP_PIX",
    origin: "PIX",
    amount,
    description: "Recarga de saldo (PIX)",
  });

  const topup = {
    id: `pix_${Date.now()}`,
    amount,
    currency: getWalletStore().currency,
    status: "CONFIRMED" as const,
    qrCode: "000201010211...STUB...",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  return NextResponse.json({
    ok: true,
    wallet: getWalletStore(),
    transaction,
    topup,
  });
}
