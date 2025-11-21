import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createTopupPending, confirmTransaction } from "@/lib/wallet/wallet.service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);
  const cardId: string | undefined = body?.cardId;

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { mensagem: "Informe um valor válido." },
      { status: 400 },
    );
  }

  if (!cardId) {
    return NextResponse.json(
      { mensagem: "Selecione um cartão." },
      { status: 400 },
    );
  }

  try {
    // Verificar autenticação
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { mensagem: "Não autorizado." },
        { status: 401 }
      );
    }

    // Buscar cartão do banco de dados
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.userId !== session.userId) {
      return NextResponse.json(
        { mensagem: "Cartão não encontrado." },
        { status: 404 }
      );
    }

    // 🔐 Aqui você executaria a cobrança/autorização com o provedor
    // Como é um stub, simulamos aprovação instantânea
    const amountCents = Math.round(amount * 100);

    // Gerar referenceId único para idempotência
    const referenceId = `card-topup:${cardId}:${Date.now()}`;

    // Criar topup pendente
    const topup = await createTopupPending(
      session.userId,
      amountCents,
      referenceId
    );

    // Confirmar imediatamente (cartão é aprovação instantânea)
    await confirmTransaction(referenceId);

    return NextResponse.json({
      ok: true,
      message: "Saldo adicionado com sucesso!",
      autorizacao: {
        id: `auth_${Date.now()}`,
        cardBrand: card.brand,
        last4: card.last4,
        amountReais: amount,
        amountCents,
      },
    });
  } catch (error) {
    console.error("[TOPUP_CARD_ERROR]", error);
    return NextResponse.json(
      { mensagem: "Erro ao processar pagamento com cartão." },
      { status: 500 }
    );
  }
}
