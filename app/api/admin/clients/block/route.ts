import { NextResponse } from 'next/server';

export async function POST() {
  // Mock: apenas retorna sucesso
  return NextResponse.json({ ok: true });
}
