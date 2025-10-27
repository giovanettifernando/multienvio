import { NextRequest, NextResponse } from "next/server";
import { mockColetasDb } from "@/lib/coletas/mock-db";
import { coletaUpdateSchema } from "@/lib/coletas/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const coleta = mockColetasDb.findById(id);

  if (!coleta) {
    return NextResponse.json(
      { error: "Coleta não encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(coleta);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = coletaUpdateSchema.parse(body);

    const existing = mockColetasDb.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Coleta não encontrada" },
        { status: 404 }
      );
    }

    const updated = mockColetasDb.update(id, validated.scheduledFor);

    return NextResponse.json(updated);
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
      { error: "Erro ao reagendar coleta" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = mockColetasDb.delete(id);

  if (!success) {
    return NextResponse.json(
      { error: "Coleta não encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: "Coleta cancelada com sucesso" });
}
