import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { applyLedgerEntry, getBillingStore } from "@/lib/billing/store";
import type { Invoice } from "@/types/billing";
import { topupSchema } from "@/lib/validation/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const store = getBillingStore();
  return NextResponse.json({ invoices: Array.from(store.invoices.values()) });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const amountParsed = topupSchema.safeParse({ amount: payload?.amount ?? 0 });
  const amount = amountParsed.success ? Number(amountParsed.data.amount.toFixed(2)) : 0;

  if (!amountParsed.success || amount <= 0) {
    return NextResponse.json(
      { mensagem: "Valor inválido" },
      { status: 400 },
    );
  }

  const invoice: Invoice = {
    id: `inv_${nanoid(8)}`,
    number: `NF-${nanoid(6).toUpperCase()}`,
    pdfUrl: `/mock/invoices/inv_${nanoid(6)}.pdf`,
    amount,
    currency: "BRL",
    createdAt: new Date().toISOString(),
  };

  const store = getBillingStore();
  store.invoices.set(invoice.id, invoice);

  applyLedgerEntry({
    id: `invoice_${invoice.id}`,
    occurredAt: invoice.createdAt,
    type: "DEBIT",
    source: "MANUAL",
    amount: -amount,
    currency: "BRL",
    description: `Fatura ${invoice.number}`,
    ref: { invoiceId: invoice.id },
  });

  return NextResponse.json(invoice, { status: 201 });
}
