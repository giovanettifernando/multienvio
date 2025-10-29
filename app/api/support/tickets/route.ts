import { NextResponse } from "next/server";

// DEPRECATED: This API route is no longer used.
// Support system now uses Zustand store (stores/support.ts) for state management.

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ 
    message: "This endpoint is deprecated.",
  }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({
    message: "This endpoint is deprecated.",
  }, { status: 410 });
}

export async function PUT() {
  return NextResponse.json({
    message: "This endpoint is deprecated.",
  }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({
    message: "This endpoint is deprecated.",
  }, { status: 410 });
}
