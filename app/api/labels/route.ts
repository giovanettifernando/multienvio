import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getShipmentStore, seedInitialShipments } from "@/lib/stores/shipments";
import type { LabelItem, LabelsResponse } from "@/lib/types/label";

type LabelInfo = {
  labelId: string;
  pdfUrl: string;
  createdAt: string;
};

export const dynamic = "force-dynamic";

// Mock data para testes
const MOCK_LABELS: LabelItem[] = [
  {
    id: "LBL-20251023-0001",
    shipmentId: "SHP-123",
    carrier: "Correios",
    service: "SEDEX",
    status: "issued",
    price: 27.9,
    currency: "BRL",
    recipient: { name: "Maria Souza", document: "123.456.789-09", city: "Curitiba", state: "PR" },
    createdAt: "2025-10-22T14:22:00.000Z",
    file: {
      base64: "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEV0aXF1ZXRhIFRlc3RlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIwCiUlRU9GCg==",
      contentType: "application/pdf"
    },
    trackingCode: "BR123456789BR"
  },
  {
    id: "LBL-20251023-0002",
    shipmentId: "SHP-124",
    carrier: "Jadlog",
    service: "Expresso",
    status: "paid",
    price: 35.50,
    currency: "BRL",
    recipient: { name: "João Silva", document: "987.654.321-00", city: "São Paulo", state: "SP" },
    createdAt: "2025-10-23T10:15:00.000Z",
  },
  {
    id: "LBL-20251023-0003",
    shipmentId: "SHP-125",
    carrier: "Loggi",
    service: "Same Day",
    status: "pending",
    price: 45.00,
    currency: "BRL",
    recipient: { name: "Ana Costa", city: "Rio de Janeiro", state: "RJ" },
    createdAt: "2025-10-23T11:30:00.000Z",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const carrier = searchParams.get('carrier') ?? 'all';
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');

  await new Promise((resolve) => setTimeout(resolve, 300));

  let filtered = [...MOCK_LABELS];

  // Filter by query
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.id.toLowerCase().includes(lower) ||
        item.shipmentId.toLowerCase().includes(lower) ||
        item.recipient.name.toLowerCase().includes(lower) ||
        item.recipient.document?.includes(q)
    );
  }

  // Filter by status
  if (status && status !== 'all') {
    filtered = filtered.filter((item) => item.status === status);
  }

  // Filter by carrier
  if (carrier && carrier !== 'all') {
    filtered = filtered.filter((item) => item.carrier === carrier);
  }

  // Filter by date range
  if (dateStart) {
    filtered = filtered.filter((item) => new Date(item.createdAt) >= new Date(dateStart));
  }
  if (dateEnd) {
    filtered = filtered.filter((item) => new Date(item.createdAt) <= new Date(dateEnd));
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = filtered.slice(start, end);

  const response: LabelsResponse = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response, { status: 200 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const shipmentId = payload?.shipmentId as string;
  const price = payload?.price as number | undefined;
  if (!shipmentId) {
    return NextResponse.json(
      { mensagem: "shipmentId é obrigatório" },
      { status: 400 },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 450));

  seedInitialShipments();
  const store = getShipmentStore();
  const shipment = store.get(shipmentId);

  if (!shipment) {
    return NextResponse.json(
      { mensagem: "Envio não encontrado" },
      { status: 404 },
    );
  }

  if (!price && typeof shipment?.price !== "number") {
    return NextResponse.json(
      { mensagem: "Informe o valor da etiqueta" },
      { status: 400 },
    );
  }

  const amount = price ?? shipment.price ?? 0;

  const chargeResponse = await fetch(new URL("/api/payments/charge", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      reason: "LABEL",
      ref: { shipmentId, labelId: "pending" },
    }),
  });

  if (!chargeResponse.ok) {
    const body = await chargeResponse.json().catch(() => undefined);
    return NextResponse.json(body ?? { mensagem: "Não foi possível cobrar" }, {
      status: chargeResponse.status,
    });
  }

  const labelId = `lbl_${nanoid(10)}`;
  const label: LabelInfo = {
    labelId,
    pdfUrl: `/mock/labels/${labelId}.pdf`,
    createdAt: new Date().toISOString(),
  };

  store.set(shipmentId, { ...shipment, label });

  return NextResponse.json({ label }, { status: 200 });
}
