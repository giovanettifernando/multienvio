/**
 * ⚠️ MOCK ENDPOINT: Este endpoint usa dados simulados (BillingStore in-memory)
 *
 * Este é um endpoint de demonstração que será substituído quando a integração
 * com o gateway de pagamento estiver completa.
 *
 * O frontend já exibe um aviso sobre isto em /app/(dashboard)/carteira/faturas/page.tsx
 *
 * Funcionalidade futura:
 * - Integração com gateway de pagamento real
 * - Geração de PDFs de faturas reais
 * - Sincronização com sistema contábil
 */

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { applyLedgerEntry, getBillingStore } from "@/lib/billing/store";
import type { Invoice } from "@/types/billing";
import { topupSchema } from "@/lib/validation/billing";


// Headers de aviso para clientes externos
const DEPRECATION_HEADERS = {
  'X-Endpoint-Status': 'MOCK',
  'X-Warning': 'Este endpoint usa dados simulados. Não usar em produção.',
  'X-Deprecation': 'Este endpoint será removido quando a integração com gateway estiver completa',
};

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const store = getBillingStore();
  return NextResponse.json(
    { invoices: Array.from(store.invoices.values()) },
    { headers: DEPRECATION_HEADERS }
  );
}

export async function POST(request: Request) {
  const payload = await request.json();
  const amountParsed = topupSchema.safeParse({ amount: payload?.amount ?? 0 });
  const amount = amountParsed.success ? Number(amountParsed.data.amount.toFixed(2)) : 0;

  if (!amountParsed.success || amount <= 0) {
    return NextResponse.json(
      { mensagem: "Valor inválido" },
      { status: 400, headers: DEPRECATION_HEADERS }
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

  return NextResponse.json(invoice, { status: 201, headers: DEPRECATION_HEADERS });
}
