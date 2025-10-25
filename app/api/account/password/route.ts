import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword || !body.confirmNewPassword) {
    return NextResponse.json(
      { ok: false, message: "Campos obrigatórios." },
      { status: 400 },
    );
  }

  if (body.newPassword !== body.confirmNewPassword) {
    return NextResponse.json(
      { ok: false, message: "As senhas não coincidem." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
