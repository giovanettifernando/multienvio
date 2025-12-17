/**
 * Tool Executors para o Assistente IA
 *
 * Implementação real das ferramentas que o LLM pode chamar.
 * Cada executor é responsável por:
 * 1. Validar argumentos
 * 2. Aplicar RBAC (usuário só acessa seus próprios dados)
 * 3. Executar a operação
 * 4. Retornar resultado formatado para o LLM
 */

import { prisma } from '@/lib/db';
import { getOrCreateWallet, centsToReais } from '@/lib/wallet/wallet.service';
import { createTicketForUser, getTicketForUser, listTicketsForUser } from '@/lib/support/service';
import { mapToUIStatus, getBackendStatusesForUIFilter, UIShipmentStatus } from '@/lib/shipments/status-labels-map';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Status Mapping (Tool status -> UI status)
// ============================================================================

/**
 * Mapeia status do tool definition para UIShipmentStatus
 * O LLM usa status simplificados em inglês, mas o backend usa labels em PT-BR
 */
const TOOL_STATUS_TO_UI_STATUS: Record<string, UIShipmentStatus> = {
  PENDING: 'Aguardando coleta',
  PROCESSING: 'Aguardando postagem',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devolvido',
};
import type {
  AssistantToolName,
  ListarEnviosArgs,
  DetalhesEnvioArgs,
  BuscarConhecimentoArgs,
  CriarTicketSuporteArgs,
  StatusTicketArgs,
  InformacoesContaArgs,
} from './definitions';

// ============================================================================
// Types
// ============================================================================

export interface ToolExecutionContext {
  userId: string;
  userName?: string;
  userEmail?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formata data para exibição
 */
function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata valor em reais
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Lista envios do usuário com filtros
 */
export async function executeListarEnvios(
  ctx: ToolExecutionContext,
  args: ListarEnviosArgs
): Promise<ToolExecutionResult> {
  try {
    const limite = Math.min(args.limite ?? 10, 20);
    const periodoDias = args.periodo_dias ?? 30;
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodoDias);

    const where: Prisma.ShipmentWhereInput = {
      senderId: ctx.userId,
      createdAt: { gte: dataInicio },
      packages: { some: {} },
    };

    // Filtro de status - converter de tool status para UI status
    if (args.status) {
      const uiStatus = TOOL_STATUS_TO_UI_STATUS[args.status];
      if (uiStatus) {
        const backendStatuses = getBackendStatusesForUIFilter(uiStatus);
        if (backendStatuses.length > 0) {
          where.status = { in: backendStatuses };
        }
      }
    }

    // Filtro de busca
    if (args.busca) {
      where.OR = [
        { platformTrackingCode: { contains: args.busca, mode: 'insensitive' } },
        { recipientName: { contains: args.busca, mode: 'insensitive' } },
        { destinationCity: { contains: args.busca, mode: 'insensitive' } },
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        platformTrackingCode: true,
        recipientName: true,
        destinationCity: true,
        destinationState: true,
        carrier: true,
        service: true,
        status: true,
        freightCost: true,
        estimatedDays: true,
        createdAt: true,
        deliveredAt: true,
      },
    });

    const items = shipments.map((s) => ({
      codigo_rastreio: s.platformTrackingCode,
      destinatario: s.recipientName || 'Não informado',
      cidade_uf: `${s.destinationCity}/${s.destinationState}`,
      transportadora: s.carrier || 'Não informado',
      servico: s.service || 'Não informado',
      status: mapToUIStatus(s.status as ShipmentStatus),
      valor_frete: formatCurrency(Number(s.freightCost) || 0),
      previsao_dias: s.estimatedDays,
      data_criacao: formatDate(s.createdAt),
      data_entrega: formatDate(s.deliveredAt),
    }));

    return {
      success: true,
      data: {
        total_encontrado: items.length,
        periodo: `últimos ${periodoDias} dias`,
        envios: items,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar envios',
    };
  }
}

/**
 * Obtém detalhes de um envio específico
 */
export async function executeDetalhesEnvio(
  ctx: ToolExecutionContext,
  args: DetalhesEnvioArgs
): Promise<ToolExecutionResult> {
  try {
    // Buscar por código de rastreio ou ID
    const shipment = await prisma.shipment.findFirst({
      where: {
        senderId: ctx.userId, // RBAC: só dados do próprio usuário
        OR: [
          { id: args.identificador },
          { platformTrackingCode: { equals: args.identificador, mode: 'insensitive' } },
          { carrierTrackingCode: { equals: args.identificador, mode: 'insensitive' } },
        ],
      },
      include: {
        trackingEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
        packages: true,
        label: true,
      },
    });

    if (!shipment) {
      return {
        success: false,
        error: `Envio não encontrado com identificador "${args.identificador}". Verifique o código de rastreio.`,
      };
    }

    const eventos = shipment.trackingEvents.map((e) => ({
      data: formatDate(e.occurredAt),
      tipo: e.type,
      descricao: e.description,
      local: e.city && e.uf ? `${e.city}/${e.uf}` : null,
    }));

    const volumes = shipment.packages.map((p, idx) => ({
      numero: idx + 1,
      dimensoes: `${p.width}x${p.height}x${p.length} cm`,
      peso: `${Number(p.weight)} kg`,
      codigo_transportadora: p.carrierTrackingCode || 'Aguardando',
    }));

    return {
      success: true,
      data: {
        codigo_rastreio: shipment.platformTrackingCode,
        codigo_transportadora: shipment.carrierTrackingCode,
        status: mapToUIStatus(shipment.status as ShipmentStatus),
        transportadora: shipment.carrier,
        servico: shipment.service,
        origem: {
          cep: shipment.originCep,
        },
        destino: {
          nome: shipment.recipientName,
          endereco: shipment.destinationAddress,
          bairro: shipment.destinationNeighborhood,
          cidade: shipment.destinationCity,
          uf: shipment.destinationState,
          cep: shipment.destinationCep,
        },
        valores: {
          frete: formatCurrency(Number(shipment.freightCost) || 0),
          valor_declarado: shipment.declaredValue
            ? formatCurrency(Number(shipment.declaredValue))
            : 'Não declarado',
        },
        prazos: {
          dias_estimados: shipment.estimatedDays,
          data_postagem: formatDate(shipment.postedAt),
          data_entrega: formatDate(shipment.deliveredAt),
        },
        volumes,
        historico_rastreamento: eventos,
        tem_etiqueta: !!shipment.label,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar detalhes do envio',
    };
  }
}

/**
 * Consulta saldo da conta
 */
export async function executeSaldoConta(
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const wallet = await getOrCreateWallet(ctx.userId);

    // Buscar últimas 5 transações
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        status: 'CONFIRMED',
      },
      orderBy: { confirmedAt: 'desc' },
      take: 5,
    });

    const ultimasTransacoes = transactions.map((tx) => ({
      tipo: tx.type,
      valor: formatCurrency(tx.amountCents / 100),
      descricao: tx.title,
      data: formatDate(tx.confirmedAt),
    }));

    return {
      success: true,
      data: {
        saldo_disponivel: formatCurrency(centsToReais(wallet.availableCents)),
        saldo_disponivel_centavos: wallet.availableCents,
        saldo_pendente: formatCurrency(centsToReais(wallet.pendingCents)),
        saldo_pendente_centavos: wallet.pendingCents,
        saldo_total: formatCurrency(centsToReais(wallet.availableCents + wallet.pendingCents)),
        ultimas_transacoes: ultimasTransacoes,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao consultar saldo',
    };
  }
}

/**
 * Busca na base de conhecimento
 */
export async function executeBuscarConhecimento(
  args: BuscarConhecimentoArgs
): Promise<ToolExecutionResult> {
  try {
    // Busca full-text no PostgreSQL
    const where: Prisma.KnowledgeBaseArticleWhereInput = {
      isPublished: true,
    };

    // Filtrar por categoria se especificada
    if (args.categoria) {
      where.category = args.categoria;
    }

    // Buscar artigos que contenham os termos da consulta
    const articles = await prisma.knowledgeBaseArticle.findMany({
      where: {
        ...where,
        OR: [
          { title: { contains: args.consulta, mode: 'insensitive' } },
          { contentMarkdown: { contains: args.consulta, mode: 'insensitive' } },
          { tags: { has: args.consulta.toLowerCase() } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        title: true,
        contentMarkdown: true,
        category: true,
        tags: true,
      },
    });

    if (articles.length === 0) {
      return {
        success: true,
        data: {
          encontrado: false,
          mensagem: `Não encontrei informações sobre "${args.consulta}" na base de conhecimento. Posso ajudar de outra forma ou criar um ticket de suporte se necessário.`,
        },
      };
    }

    // Formatar artigos para resposta
    const resultados = articles.map((a) => ({
      titulo: a.title,
      categoria: a.category,
      conteudo: a.contentMarkdown.slice(0, 500) + (a.contentMarkdown.length > 500 ? '...' : ''),
      tags: a.tags,
    }));

    return {
      success: true,
      data: {
        encontrado: true,
        total: articles.length,
        artigos: resultados,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar conhecimento',
    };
  }
}

/**
 * Cria ticket de suporte
 */
export async function executeCriarTicketSuporte(
  ctx: ToolExecutionContext,
  args: CriarTicketSuporteArgs
): Promise<ToolExecutionResult> {
  // Verificar confirmação obrigatória
  if (!args.confirmado) {
    return {
      success: false,
      error: 'Para criar um ticket de suporte, preciso da sua confirmação explícita. Por favor, confirme se deseja criar o ticket.',
    };
  }

  try {
    // Buscar dados do usuário para requester
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, phone: true },
    });

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado',
      };
    }

    // Mapear categoria do assistente para tags
    const tagsMap: Record<string, string[]> = {
      envio: ['envio', 'rastreamento', 'entrega'],
      pagamento: ['pagamento', 'cobrança', 'financeiro'],
      conta: ['conta', 'perfil', 'cadastro'],
      tecnico: ['tecnico', 'bug', 'erro'],
      outros: ['outros'],
    };

    // Mapear prioridade
    const priorityMap: Record<string, 'baixa' | 'media' | 'alta' | 'critica'> = {
      baixa: 'baixa',
      media: 'media',
      alta: 'alta',
    };

    const ticket = await createTicketForUser(ctx.userId, {
      requester: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      subject: args.titulo,
      description: args.descricao + (args.envio_relacionado ? `\n\nEnvio relacionado: ${args.envio_relacionado}` : ''),
      priority: priorityMap[args.prioridade ?? 'media'] ?? 'media',
      tags: tagsMap[args.categoria] ?? ['outros'],
      attachments: [],
    });

    return {
      success: true,
      data: {
        mensagem: 'Ticket criado com sucesso!',
        numero_ticket: ticket.id,
        status: ticket.status,
        prioridade: ticket.priority,
        assunto: ticket.subject,
        instrucoes: 'Você pode acompanhar o status do ticket na área "Minha Conta" > "Suporte". Nossa equipe irá responder em breve.',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar ticket',
    };
  }
}

/**
 * Consulta status de ticket
 */
export async function executeStatusTicket(
  ctx: ToolExecutionContext,
  args: StatusTicketArgs
): Promise<ToolExecutionResult> {
  try {
    const ticket = await getTicketForUser(ctx.userId, args.ticket_id);

    if (!ticket) {
      // Tentar buscar por número em outros formatos
      const tickets = await listTicketsForUser(ctx.userId, {});
      const foundTicket = tickets.find(
        (t) =>
          t.id === args.ticket_id ||
          t.id.includes(args.ticket_id) ||
          t.subject.toLowerCase().includes(args.ticket_id.toLowerCase())
      );

      if (!foundTicket) {
        return {
          success: false,
          error: `Ticket "${args.ticket_id}" não encontrado. Verifique o número do ticket.`,
        };
      }

      return {
        success: true,
        data: formatTicketData(foundTicket),
      };
    }

    return {
      success: true,
      data: formatTicketData(ticket),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar ticket',
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTicketData(ticket: any) {
  const statusLabels: Record<string, string> = {
    aberto: 'Aberto',
    em_atendimento: 'Em Atendimento',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
  };

  const priorityLabels: Record<string, string> = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  };

  return {
    numero_ticket: ticket.id,
    assunto: ticket.subject,
    status: statusLabels[ticket.status] || ticket.status,
    prioridade: priorityLabels[ticket.priority] || ticket.priority,
    data_abertura: ticket.createdAt,
    ultima_atualizacao: ticket.updatedAt,
    quantidade_mensagens: ticket.messages?.length || 0,
    ultimas_mensagens: ticket.messages?.slice(-3).map((m: { at: string; authorRole: string; text: string }) => ({
      data: m.at,
      autor: m.authorRole === 'admin' ? 'Suporte' : 'Você',
      mensagem: m.text.slice(0, 200) + (m.text.length > 200 ? '...' : ''),
    })) || [],
  };
}

/**
 * Informações da conta do usuário
 */
export async function executeInformacoesConta(
  ctx: ToolExecutionContext,
  args: InformacoesContaArgs
): Promise<ToolExecutionResult> {
  try {
    const incluir = args.incluir ?? ['perfil', 'endereco', 'plano', 'configuracoes'];

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: {
        addresses: incluir.includes('endereco'),
      },
    });

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado: Record<string, any> = {};

    if (incluir.includes('perfil')) {
      resultado.perfil = {
        nome: user.name,
        email: user.email,
        telefone: user.phone,
        documento: user.cpf,
        email_verificado: user.emailVerified,
        status_conta: user.status,
        membro_desde: formatDate(user.createdAt),
      };

      if (user.hasCompany) {
        resultado.perfil.empresa = {
          cnpj: user.cnpj,
          razao_social: user.razaoSocial,
        };
      }
    }

    if (incluir.includes('endereco') && user.addresses) {
      resultado.enderecos = user.addresses.map((addr) => ({
        apelido: addr.label,
        logradouro: addr.logradouro,
        numero: addr.numero,
        complemento: addr.complemento,
        bairro: addr.bairro,
        cidade: addr.cidade,
        uf: addr.uf,
        cep: addr.cep,
        principal: addr.isDefault,
      }));
    }

    if (incluir.includes('plano')) {
      // Buscar informações de uso
      const [totalEnvios, enviosMes] = await Promise.all([
        prisma.shipment.count({ where: { senderId: ctx.userId } }),
        prisma.shipment.count({
          where: {
            senderId: ctx.userId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

      resultado.plano = {
        tipo: 'Padrão', // Pode ser expandido para planos diferentes no futuro
        total_envios: totalEnvios,
        envios_este_mes: enviosMes,
      };
    }

    if (incluir.includes('configuracoes')) {
      resultado.configuracoes = {
        notificacoes_email: true, // Pode ser expandido para configurações reais
        autenticacao_dois_fatores: false,
      };
    }

    return {
      success: true,
      data: resultado,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar informações da conta',
    };
  }
}

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Executa uma ferramenta pelo nome com os argumentos fornecidos
 */
export async function executeTool(
  toolName: AssistantToolName,
  args: unknown,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'listar_envios':
      return executeListarEnvios(ctx, args as ListarEnviosArgs);

    case 'detalhes_envio':
      return executeDetalhesEnvio(ctx, args as DetalhesEnvioArgs);

    case 'saldo_conta':
      return executeSaldoConta(ctx);

    case 'buscar_conhecimento':
      return executeBuscarConhecimento(args as BuscarConhecimentoArgs);

    case 'criar_ticket_suporte':
      return executeCriarTicketSuporte(ctx, args as CriarTicketSuporteArgs);

    case 'status_ticket':
      return executeStatusTicket(ctx, args as StatusTicketArgs);

    case 'informacoes_conta':
      return executeInformacoesConta(ctx, args as InformacoesContaArgs);

    default:
      return {
        success: false,
        error: `Ferramenta desconhecida: ${toolName}`,
      };
  }
}
