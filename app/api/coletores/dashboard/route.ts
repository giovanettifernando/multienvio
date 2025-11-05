/**
 * API Route para dashboard de coletor autônomo
 * GET /api/coletores/dashboard - Retorna KPIs e dados do dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

/**
 * GET /api/coletores/dashboard
 * Retorna KPIs e últimas coletas do coletor
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('coletor-token');

    if (!token) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    // TODO: Implement real dashboard queries
    // For now, returning mock data
    const dashboardData = {
      kpis: {
        pending: { value: 0, label: 'Coletas Pendentes' },
        today: { value: 0, label: 'Coletas Hoje' },
        monthly: { value: 0, change: 0, label: 'Coletas no Mês' },
        commission: { value: 0, change: 0, label: 'Comissão (R$)' },
      },
      recentCollections: [],
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[GET /api/coletores/dashboard] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao carregar dashboard' },
      { status: 500 }
    );
  }
}
