export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import {
  addMessageToTicketForAutonomousCollector,
  getTicketForAutonomousCollector,
} from '@/lib/support/autonomous-collector-service';
import { z } from 'zod';

const AddMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia'),
  // NOTA: Upload de anexos não está implementado para coletores autônomos
  // Campo mantido para futura implementação quando houver storage configurado
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        url: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

/**
 * POST /api/coletores/suporte/[id]/mensagens
 * Adiciona mensagem a um ticket do coletor autônomo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se o ticket existe e pertence ao coletor
    const ticket = await getTicketForAutonomousCollector(id, session.coletorId);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = AddMessageSchema.parse(body);

    const message = await addMessageToTicketForAutonomousCollector(
      id,
      session.coletorId,
      validatedData.content,
      validatedData.attachments
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('[COLETORES_SUPORTE_ADD_MESSAGE]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Erro ao adicionar mensagem';
    return NextResponse.json({ message }, { status: 500 });
  }
}
