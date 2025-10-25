import { NextRequest, NextResponse } from "next/server";
import { pushTx, getWalletStore } from "@/lib/api/stores";
import { getCardsStore } from "@/lib/api/stores";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);
  const cardId: string | undefined = body?.cardId;

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { mensagem: "Informe um valor válido." },
      { status: 400 },
    );
  }

  if (!cardId) {
    return NextResponse.json(
      { mensagem: "Selecione um cartão." },
      { status: 400 },
    );
  }

  try {
    const card = getCardsStore().find((card) => card.id === cardId);
    if (!card) {
      return NextResponse.json(
        { mensagem: "Cartão não encontrado." },
        { status: 404 }
      );
    }

    // 🔐 Aqui você executaria a cobrança/autorização com o provedor
    // Como é um stub, apenas retornamos OK
    const tx = pushTx({
      type: "TOPUP_CARD",
      origin: `Cartão ${card.brand} •••• ${card.last4}`,
      amount,
      description: "Recarga de saldo (cartão)",
    });

    return NextResponse.json({
      ok: true,
      autorizacao: {
        id: `auth_${Date.now()}`,
        cardBrand: card.brand,
        last4: card.last4,
        amount,
        currency: getWalletStore().currency,
      },
      wallet: getWalletStore(),
      transaction: tx,
    });
  } catch (error) {
    return NextResponse.json(
      { mensagem: "Erro ao processar pagamento com cartão." },
      { status: 500 }
    );
  }
}
