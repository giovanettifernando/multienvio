import { NextRequest, NextResponse } from "next/server";
import { mockColetasDb } from "@/lib/coletas/mock-db";
import { coletaCreateSchema } from "@/lib/coletas/schemas";
import type { ColetaFilters } from "@/lib/coletas/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get("status") || "all";
  const sortParam = searchParams.get("sort") || "scheduledFor_desc";

  const filters: ColetaFilters = {
    q: searchParams.get("q") || undefined,
    status: statusParam as ColetaFilters["status"],
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    pageSize: parseInt(searchParams.get("pageSize") || "10"),
    sort: sortParam as ColetaFilters["sort"],
  };

  let filtered = mockColetasDb.getAll();

  // Filter by search query (trackingCode or CEPs)
  if (filters.q) {
    const query = filters.q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.trackingCode.toLowerCase().includes(query) ||
        c.origemCep.replace(/\D/g, "").includes(query.replace(/\D/g, "")) ||
        c.destinoCep.replace(/\D/g, "").includes(query.replace(/\D/g, ""))
    );
  }

  // Filter by status
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((c) => c.status === filters.status);
  }

  // Filter by date range
  if (filters.from) {
    filtered = filtered.filter((c) => c.scheduledFor >= filters.from!);
  }
  if (filters.to) {
    filtered = filtered.filter((c) => c.scheduledFor <= filters.to!);
  }

  // Sort
  switch (filters.sort) {
    case "scheduledFor_asc":
      filtered.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
      break;
    case "scheduledFor_desc":
      filtered.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
      break;
    case "created_asc":
      filtered.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      break;
    case "created_desc":
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
    default:
      filtered.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  }

  const total = filtered.length;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = filtered.slice(start, end);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = coletaCreateSchema.parse(body);

    const newColeta = mockColetasDb.create({
      trackingCode: validated.trackingCode,
      origemCep: validated.origemCep,
      destinoCep: validated.destinoCep,
      scheduledFor: validated.scheduledFor,
    });

    return NextResponse.json(newColeta, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError"
    ) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          details: "errors" in error ? error.errors : [],
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao criar coleta" },
      { status: 500 }
    );
  }
}
