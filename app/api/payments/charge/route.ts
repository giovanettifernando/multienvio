import { NextResponse } from "next/server";
import { applyLedgerEntry, getBillingStore, getDefaultCard } from "@/lib/billing/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const amountRaw = payload?.amount;
  const amount = typeof amountRaw === "number" ? Number(amountRaw.toFixed(2)) : NaN;
  const reason = payload?.reason as "LABEL" | "ORDER" | undefined;
  const ref = payload?.ref as Record<string, string> | undefined;

  if (!Number.isFinite(amount) || amount <= 0 || !reason) {
    return NextResponse.json(
      { mensagem: "Dados inválidos" },
      { status: 400 },
    );
  }

  const store = getBillingStore();

  if (store.wallet.balance >= amount) {
    const entry = applyLedgerEntry({
      id: `charge_${reason}_${Date.now()}`,
      occurredAt: new Date().toISOString(),
      type: "DEBIT",
      source: reason === "LABEL" ? "SHIPMENT_LABEL" : "ORDER",
      amount: -amount,
      currency: "BRL",
      description: reason === "LABEL" ? "Cobrança de etiqueta" : "Cobrança de pedido",
      ref,
    });
    return NextResponse.json({ entry });
  }

  const card = getDefaultCard();
  if (!card) {
    return NextResponse.json(
      {
        codigo: "INSUFFICIENT_FUNDS",
        mensagem: "Saldo insuficiente. Adicione saldo ou cadastre um cartão.",
      },
      { status: 422 },
    );
  }

  applyLedgerEntry({
    id: `auto_topup_${Date.now()}`,
    occurredAt: new Date().toISOString(),
    type: "CREDIT",
    source: "TOPUP_CARD",
    amount,
    currency: "BRL",
    description: `Recarga automática cartão **** ${card.last4}`,
    ref: { topupId: card.id },
  });

  const entry = applyLedgerEntry({
    id: `charge_${reason}_${Date.now()}`,
    occurredAt: new Date().toISOString(),
    type: "DEBIT",
    source: reason === "LABEL" ? "SHIPMENT_LABEL" : "ORDER",
    amount: -amount,
    currency: "BRL",
    description: reason === "LABEL" ? "Cobrança de etiqueta" : "Cobrança de pedido",
    ref,
  });

  return NextResponse.json({ entry });
}
