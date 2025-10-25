import { NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const text = searchParams.get("q")?.toLowerCase() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await new Promise((resolve) => setTimeout(resolve, 250));

  const store = getBillingStore();
  let entries = store.ledger;

  if (type) {
    entries = entries.filter((entry) => entry.type === type);
  }

  if (source) {
    entries = entries.filter((entry) => entry.source === source);
  }

  if (from) {
    const fromDate = new Date(from);
    entries = entries.filter(
      (entry) => new Date(entry.occurredAt) >= fromDate,
    );
  }

  if (to) {
    const toDate = new Date(to);
    entries = entries.filter((entry) => new Date(entry.occurredAt) <= toDate);
  }

  if (text) {
    entries = entries.filter(
      (entry) =>
        entry.description.toLowerCase().includes(text) ||
        entry.ref?.shipmentId?.toLowerCase().includes(text) ||
        entry.ref?.orderId?.toLowerCase().includes(text) ||
        entry.ref?.labelId?.toLowerCase().includes(text) ||
        entry.ref?.invoiceId?.toLowerCase().includes(text),
    );
  }

  return NextResponse.json({ dados: entries });
}
