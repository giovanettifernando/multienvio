import { NextResponse } from 'next/server';

export async function PUT() {
  // Mock: apenas retorna sucesso
  return NextResponse.json({ ok: true });
}
