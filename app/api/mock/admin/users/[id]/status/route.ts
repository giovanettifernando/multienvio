import { NextRequest, NextResponse } from "next/server";
import { mockUsersDb } from "@/lib/auth/mock-db";
import { toggleStatusSchema } from "@/lib/auth/schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = toggleStatusSchema.parse(body);

    const user = mockUsersDb.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Prevent blocking master user
    if (id === "master-001" && validated.status === "blocked") {
      return NextResponse.json(
        { error: "Não é possível bloquear o usuário master" },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = mockUsersDb.updateStatus(id, validated.status as any);

    return NextResponse.json(updated);
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: "errors" in error ? error.errors : [] },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao atualizar status" },
      { status: 500 }
    );
  }
}
