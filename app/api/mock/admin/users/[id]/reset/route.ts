import { NextRequest, NextResponse } from "next/server";
import { mockUsersDb } from "@/lib/auth/mock-db";

export async function POST(
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

  // Simulate password reset
  return NextResponse.json({
    message: `Instruções de redefinição de senha enviadas para ${user.email} (simulado)`,
  });
}
