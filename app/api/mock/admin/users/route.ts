import { NextRequest, NextResponse } from "next/server";
import { mockUsersDb } from "@/lib/auth/mock-db";
import { adminUserSchema } from "@/lib/auth/schemas";
import type { AdminUserFilters } from "@/lib/auth/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get("status") || "all";
  const sortParam = searchParams.get("sort") || "updated_desc";

  const filters: AdminUserFilters = {
    q: searchParams.get("q") || undefined,
    status: statusParam as "all" | "active" | "blocked",
    role: searchParams.get("role") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    pageSize: parseInt(searchParams.get("pageSize") || "10"),
    sort: sortParam as "name_asc" | "name_desc" | "updated_asc" | "updated_desc",
  };

  let filtered = mockUsersDb.getAll();

  // Filter by search query (name or email)
  if (filters.q) {
    const query = filters.q.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((u) => u.status === filters.status);
  }

  // Filter by role
  if (filters.role) {
    filtered = filtered.filter((u) => u.roles.includes(filters.role!));
  }

  // Sort
  switch (filters.sort) {
    case "name_asc":
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      filtered.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "updated_asc":
      filtered.sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      break;
    case "updated_desc":
    default:
      filtered.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      break;
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
    const validated = adminUserSchema.parse(body);

    // Check if email already exists
    const existing = mockUsersDb.findByEmail(validated.email);
    if (existing) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 409 }
      );
    }

    const newUser = mockUsersDb.create({
      name: validated.name,
      email: validated.email,
      phone: validated.phone || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: validated.status as any,
      roles: validated.roles,
      lastLoginAt: null,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: "errors" in error ? error.errors : [] },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}
