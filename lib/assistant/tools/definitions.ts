/**
 * Tool Definitions para o Assistente IA
 *
 * Define as ferramentas disponíveis para o LLM usar durante conversas.
 * Cada tool tem um schema JSON compatível com OpenRouter/OpenAI function calling.
 *
 * Tools disponíveis:
 * 1. listar_envios - Lista envios do usuário
 * 2. detalhes_envio - Detalhes de um envio específico
 * 3. saldo_conta - Consulta saldo da conta
 * 4. buscar_conhecimento - Busca na base de conhecimento
 * 5. criar_ticket_suporte - Cria ticket de suporte
 * 6. status_ticket - Consulta status de ticket
 * 7. informacoes_conta - Informações do perfil
 */

import type { OpenRouterTool } from '@/lib/integrations/openrouter/client';

// ============================================================================
// Tool Definitions
// ============================================================================

export const ASSISTANT_TOOLS: OpenRouterTool[] = [
  {
    type: 'function',
    function: {
      name: 'listar_envios',
      description:
        'Lista os envios do usuário com filtros opcionais. Retorna até 10 envios por vez. Use para responder perguntas sobre envios recentes, histórico de entregas, ou buscar envios específicos.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED'],
            description: 'Filtrar por status do envio. PENDING=aguardando, PROCESSING=processando, IN_TRANSIT=em trânsito, DELIVERED=entregue, CANCELLED=cancelado, RETURNED=devolvido',
          },
          periodo_dias: {
            type: 'number',
            description: 'Quantidade de dias para trás a partir de hoje para buscar envios. Padrão: 30',
            minimum: 1,
            maximum: 365,
          },
          limite: {
            type: 'number',
            description: 'Quantidade máxima de envios a retornar. Padrão: 10, máximo: 20',
            minimum: 1,
            maximum: 20,
          },
          busca: {
            type: 'string',
            description: 'Termo para buscar por código de rastreio, nome do destinatário ou cidade',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detalhes_envio',
      description:
        'Obtém detalhes completos de um envio específico, incluindo rastreamento, valores e eventos. Use quando o usuário perguntar sobre um envio específico pelo código de rastreio ou ID.',
      parameters: {
        type: 'object',
        properties: {
          identificador: {
            type: 'string',
            description: 'Código de rastreio (ex: AA123456789BR) ou ID interno do envio',
          },
        },
        required: ['identificador'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'saldo_conta',
      description:
        'Consulta o saldo atual da conta do usuário, incluindo saldo disponível, bloqueado e total de créditos. Use para responder perguntas sobre saldo, créditos disponíveis ou situação financeira da conta.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_conhecimento',
      description:
        'Busca informações na base de conhecimento do sistema. Use para responder perguntas sobre: como usar a plataforma, políticas, prazos, preços, procedimentos, e dúvidas frequentes.',
      parameters: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description: 'Termo ou pergunta para buscar na base de conhecimento',
          },
          categoria: {
            type: 'string',
            enum: ['envios', 'pagamentos', 'conta', 'suporte', 'politicas', 'geral'],
            description: 'Categoria para filtrar os resultados (opcional)',
          },
        },
        required: ['consulta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_ticket_suporte',
      description:
        'Cria um novo ticket de suporte para o usuário. IMPORTANTE: Antes de usar esta ferramenta, sempre confirme com o usuário que ele deseja realmente criar o ticket e peça confirmação.',
      parameters: {
        type: 'object',
        properties: {
          titulo: {
            type: 'string',
            description: 'Título resumido do problema ou solicitação (máx 100 caracteres)',
            maxLength: 100,
          },
          descricao: {
            type: 'string',
            description: 'Descrição detalhada do problema ou solicitação',
          },
          categoria: {
            type: 'string',
            enum: ['envio', 'pagamento', 'conta', 'tecnico', 'outros'],
            description: 'Categoria do ticket',
          },
          prioridade: {
            type: 'string',
            enum: ['baixa', 'media', 'alta'],
            description: 'Prioridade do ticket. Padrão: media',
          },
          envio_relacionado: {
            type: 'string',
            description: 'Código de rastreio ou ID do envio relacionado ao ticket (se aplicável)',
          },
          confirmado: {
            type: 'boolean',
            description: 'OBRIGATÓRIO: Deve ser true. Indica que o usuário confirmou explicitamente a criação do ticket.',
          },
        },
        required: ['titulo', 'descricao', 'categoria', 'confirmado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'status_ticket',
      description:
        'Consulta o status e histórico de um ticket de suporte existente. Use quando o usuário perguntar sobre um chamado ou ticket específico.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: {
            type: 'string',
            description: 'ID ou número do ticket de suporte',
          },
        },
        required: ['ticket_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'informacoes_conta',
      description:
        'Retorna informações do perfil e conta do usuário, como nome, email, documento, plano atual e configurações. Use para responder perguntas sobre "minha conta", "meus dados" ou configurações do usuário.',
      parameters: {
        type: 'object',
        properties: {
          incluir: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['perfil', 'endereco', 'plano', 'configuracoes'],
            },
            description: 'Quais informações incluir na resposta. Padrão: todas',
          },
        },
        required: [],
      },
    },
  },
];

// ============================================================================
// Tool Name Type
// ============================================================================

export type AssistantToolName =
  | 'listar_envios'
  | 'detalhes_envio'
  | 'saldo_conta'
  | 'buscar_conhecimento'
  | 'criar_ticket_suporte'
  | 'status_ticket'
  | 'informacoes_conta';

// ============================================================================
// Tool Arguments Types
// ============================================================================

export interface ListarEnviosArgs {
  status?: 'PENDING' | 'PROCESSING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
  periodo_dias?: number;
  limite?: number;
  busca?: string;
}

export interface DetalhesEnvioArgs {
  identificador: string;
}

export interface SaldoContaArgs {
  // Sem parâmetros
}

export interface BuscarConhecimentoArgs {
  consulta: string;
  categoria?: 'envios' | 'pagamentos' | 'conta' | 'suporte' | 'politicas' | 'geral';
}

export interface CriarTicketSuporteArgs {
  titulo: string;
  descricao: string;
  categoria: 'envio' | 'pagamento' | 'conta' | 'tecnico' | 'outros';
  prioridade?: 'baixa' | 'media' | 'alta';
  envio_relacionado?: string;
  confirmado: boolean;
}

export interface StatusTicketArgs {
  ticket_id: string;
}

export interface InformacoesContaArgs {
  incluir?: Array<'perfil' | 'endereco' | 'plano' | 'configuracoes'>;
}

// Union type para todos os argumentos
export type ToolArgs =
  | { name: 'listar_envios'; args: ListarEnviosArgs }
  | { name: 'detalhes_envio'; args: DetalhesEnvioArgs }
  | { name: 'saldo_conta'; args: SaldoContaArgs }
  | { name: 'buscar_conhecimento'; args: BuscarConhecimentoArgs }
  | { name: 'criar_ticket_suporte'; args: CriarTicketSuporteArgs }
  | { name: 'status_ticket'; args: StatusTicketArgs }
  | { name: 'informacoes_conta'; args: InformacoesContaArgs };
