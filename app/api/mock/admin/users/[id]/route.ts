import { NextRequest, NextResponse } from "next/server";
import { mockUsersDb } from "@/lib/auth/mock-db";
import { updateAdminUserSchema } from "@/lib/auth/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = mockUsersDb.findById(id);

  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateAdminUserSchema.parse(body);

    const existing = mockUsersDb.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Check if email is being changed and if it's already in use
    if (validated.email && validated.email !== existing.email) {
      const emailExists = mockUsersDb.findByEmail(validated.email);
      if (emailExists) {
        return NextResponse.json(
          { error: "E-mail já cadastrado" },
          { status: 409 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = mockUsersDb.update(id, validated as any);

    return NextResponse.json(updated);
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: "errors" in error ? error.errors : [] },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Prevent deletion of master user
  if (id === "master-001") {
    return NextResponse.json(
      { error: "Não é possível excluir o usuário master" },
      { status: 403 }
    );
  }

  const success = mockUsersDb.delete(id);

  if (!success) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: "Usuário excluído com sucesso" });
}
