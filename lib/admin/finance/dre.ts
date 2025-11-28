/**
 * Tipos e estrutura do Plano de Contas DRE
 */

export interface DREAccount {
  code: string;
  name: string;
  level: 1 | 2 | 3;
  type: 'group' | 'subgroup' | 'account';
  isTotal?: boolean;
  isBold?: boolean;
}

export interface DREMonthData {
  month: number;
  year: number;
  values: Record<string, number>; // code -> value in cents
}

export interface DREResponse {
  year: number;
  startMonth: number;
  endMonth: number;
  months: DREMonthData[];
  accounts: DREAccount[];
}

export interface DREFilters {
  year: number;
  startMonth: number;
  endMonth: number;
}

// Plano de contas DRE
export const DRE_CHART_OF_ACCOUNTS: DREAccount[] = [
  // 1.0 Receitas Operacionais
  { code: '1.0', name: 'Receitas Operacionais', level: 1, type: 'group', isBold: true },

  { code: '1.1', name: 'Comissão sobre Envios', level: 2, type: 'subgroup' },
  { code: '1.1.01', name: 'Comissão sobre frete por envio', level: 3, type: 'account' },
  { code: '1.1.02', name: 'Comissão sobre serviços adicionais do envio', level: 3, type: 'account' },

  { code: '1.2', name: 'Comissão sobre Coletas', level: 2, type: 'subgroup' },
  { code: '1.2.01', name: 'Comissão por coleta na origem', level: 3, type: 'account' },
  { code: '1.2.02', name: 'Comissão por logística reversa', level: 3, type: 'account' },

  { code: '1.3', name: 'Outras Receitas Operacionais', level: 2, type: 'subgroup' },
  { code: '1.3.01', name: 'Multas e penalidades cobradas', level: 3, type: 'account' },
  { code: '1.3.02', name: 'Ajustes positivos de cobrança', level: 3, type: 'account' },
  { code: '1.3.03', name: 'Outras receitas operacionais diversas', level: 3, type: 'account' },

  // 2.0 Deduções da Receita
  { code: '2.0', name: 'Deduções da Receita', level: 1, type: 'group', isBold: true },

  { code: '2.1', name: 'Impostos sobre faturamento', level: 2, type: 'subgroup' },
  { code: '2.1.01', name: 'ISS', level: 3, type: 'account' },
  { code: '2.1.02', name: 'PIS', level: 3, type: 'account' },
  { code: '2.1.03', name: 'COFINS', level: 3, type: 'account' },

  { code: '2.2', name: 'Estornos e Devoluções', level: 2, type: 'subgroup' },
  { code: '2.2.01', name: 'Estornos de envios', level: 3, type: 'account' },
  { code: '2.2.02', name: 'Estornos de coletas', level: 3, type: 'account' },

  { code: '2.3', name: 'Descontos Comerciais', level: 2, type: 'subgroup' },
  { code: '2.3.01', name: 'Descontos concedidos em envios', level: 3, type: 'account' },
  { code: '2.3.02', name: 'Descontos concedidos em coletas', level: 3, type: 'account' },

  // Receita Líquida (calculado)
  { code: 'RL', name: 'RECEITA LÍQUIDA', level: 1, type: 'group', isBold: true, isTotal: true },

  // 3.0 Custos Variáveis
  { code: '3.0', name: 'Custos Variáveis', level: 1, type: 'group', isBold: true },

  { code: '3.1', name: 'Repasses a Transportadoras', level: 2, type: 'subgroup' },
  { code: '3.1.01', name: 'Fretes repassados', level: 3, type: 'account' },

  { code: '3.2', name: 'Comissões Operacionais', level: 2, type: 'subgroup' },
  { code: '3.2.01', name: 'Comissão de pontos de coleta', level: 3, type: 'account' },
  { code: '3.2.02', name: 'Comissão de coletores autônomos', level: 3, type: 'account' },

  { code: '3.3', name: 'Taxas de Meios de Pagamento', level: 2, type: 'subgroup' },
  { code: '3.3.01', name: 'Taxas de cartão de crédito', level: 3, type: 'account' },
  { code: '3.3.02', name: 'Taxas de Pix e boleto', level: 3, type: 'account' },
  { code: '3.3.03', name: 'Tarifas de antecipação de recebíveis', level: 3, type: 'account' },

  { code: '3.4', name: 'Outros Custos Variáveis', level: 2, type: 'subgroup' },
  { code: '3.4.01', name: 'Custo de seguro de carga', level: 3, type: 'account' },
  { code: '3.4.02', name: 'Custos variáveis de APIs e serviços', level: 3, type: 'account' },

  // Margem de Contribuição (calculado)
  { code: 'MC', name: 'MARGEM DE CONTRIBUIÇÃO', level: 1, type: 'group', isBold: true, isTotal: true },

  // 4.0 Despesas Comerciais
  { code: '4.0', name: 'Despesas Comerciais', level: 1, type: 'group', isBold: true },

  { code: '4.1', name: 'Comissões de Vendas', level: 2, type: 'subgroup' },
  { code: '4.1.01', name: 'Comissão equipe interna', level: 3, type: 'account' },
  { code: '4.1.02', name: 'Comissão canais de venda', level: 3, type: 'account' },

  { code: '4.2', name: 'Marketing e Prospecção', level: 2, type: 'subgroup' },
  { code: '4.2.01', name: 'Mídia e tráfego pago', level: 3, type: 'account' },
  { code: '4.2.02', name: 'Ferramentas de marketing e CRM', level: 3, type: 'account' },
  { code: '4.2.03', name: 'Produção de materiais de marketing', level: 3, type: 'account' },

  // 5.0 Despesas Operacionais
  { code: '5.0', name: 'Despesas Operacionais', level: 1, type: 'group', isBold: true },

  { code: '5.1', name: 'Operação e Suporte', level: 2, type: 'subgroup' },
  { code: '5.1.01', name: 'Salários e encargos de operação', level: 3, type: 'account' },
  { code: '5.1.02', name: 'Despesas com atendimento e suporte', level: 3, type: 'account' },
  { code: '5.1.03', name: 'Treinamentos da equipe operacional', level: 3, type: 'account' },

  { code: '5.2', name: 'Logística Interna', level: 2, type: 'subgroup' },
  { code: '5.2.01', name: 'Despesas de deslocamento operacional', level: 3, type: 'account' },
  { code: '5.2.02', name: 'Materiais de apoio operacional', level: 3, type: 'account' },

  // 6.0 Despesas com Tecnologia
  { code: '6.0', name: 'Despesas com Tecnologia', level: 1, type: 'group', isBold: true },

  { code: '6.1', name: 'Infraestrutura', level: 2, type: 'subgroup' },
  { code: '6.1.01', name: 'Serviços de cloud e servidores', level: 3, type: 'account' },
  { code: '6.1.02', name: 'Hospedagem de aplicações e bancos de dados', level: 3, type: 'account' },

  { code: '6.2', name: 'Ferramentas e Licenças de Desenvolvimento', level: 2, type: 'subgroup' },
  { code: '6.2.01', name: 'Ferramentas de versionamento e integração', level: 3, type: 'account' },
  { code: '6.2.02', name: 'Licenças de software de desenvolvimento', level: 3, type: 'account' },
  { code: '6.2.03', name: 'Serviços de monitoramento e observabilidade', level: 3, type: 'account' },

  { code: '6.3', name: 'Serviços de Terceiros em Tecnologia', level: 2, type: 'subgroup' },
  { code: '6.3.01', name: 'Contratos de desenvolvimento terceirizado', level: 3, type: 'account' },
  { code: '6.3.02', name: 'Serviços especializados de tecnologia', level: 3, type: 'account' },

  // 7.0 Despesas Gerais e Administrativas
  { code: '7.0', name: 'Despesas Gerais e Administrativas', level: 1, type: 'group', isBold: true },

  { code: '7.1', name: 'Pessoal Administrativo', level: 2, type: 'subgroup' },
  { code: '7.1.01', name: 'Salários e encargos administrativos', level: 3, type: 'account' },
  { code: '7.1.02', name: 'Pró labore', level: 3, type: 'account' },

  { code: '7.2', name: 'Serviços Profissionais', level: 2, type: 'subgroup' },
  { code: '7.2.01', name: 'Contabilidade e fiscal', level: 3, type: 'account' },
  { code: '7.2.02', name: 'Consultoria jurídica', level: 3, type: 'account' },
  { code: '7.2.03', name: 'Consultorias administrativas', level: 3, type: 'account' },

  { code: '7.3', name: 'Estrutura Administrativa', level: 2, type: 'subgroup' },
  { code: '7.3.01', name: 'Aluguel e condomínio', level: 3, type: 'account' },
  { code: '7.3.02', name: 'Energia e água', level: 3, type: 'account' },
  { code: '7.3.03', name: 'Telecomunicações e internet', level: 3, type: 'account' },

  { code: '7.4', name: 'Viagens e Representação', level: 2, type: 'subgroup' },
  { code: '7.4.01', name: 'Viagens de negócios', level: 3, type: 'account' },
  { code: '7.4.02', name: 'Refeições e representação', level: 3, type: 'account' },

  { code: '7.5', name: 'Despesas Bancárias Administrativas', level: 2, type: 'subgroup' },
  { code: '7.5.01', name: 'Tarifas bancárias administrativas', level: 3, type: 'account' },
  { code: '7.5.02', name: 'Outras despesas financeiras operacionais', level: 3, type: 'account' },

  // EBITDA (calculado)
  { code: 'EBITDA', name: 'EBITDA', level: 1, type: 'group', isBold: true, isTotal: true },

  // 8.0 Depreciação e Amortização
  { code: '8.0', name: 'Depreciação e Amortização', level: 1, type: 'group', isBold: true },

  { code: '8.1', name: 'Depreciação', level: 2, type: 'subgroup' },
  { code: '8.1.01', name: 'Depreciação de equipamentos', level: 3, type: 'account' },
  { code: '8.1.02', name: 'Depreciação de servidores e hardware', level: 3, type: 'account' },

  { code: '8.2', name: 'Amortização', level: 2, type: 'subgroup' },
  { code: '8.2.01', name: 'Amortização de softwares', level: 3, type: 'account' },
  { code: '8.2.02', name: 'Amortização de ativos intangíveis', level: 3, type: 'account' },

  // EBIT (calculado)
  { code: 'EBIT', name: 'EBIT (Resultado Operacional)', level: 1, type: 'group', isBold: true, isTotal: true },

  // 9.0 Resultado Financeiro
  { code: '9.0', name: 'Resultado Financeiro', level: 1, type: 'group', isBold: true },

  { code: '9.1', name: 'Receitas Financeiras', level: 2, type: 'subgroup' },
  { code: '9.1.01', name: 'Rendimentos de aplicações financeiras', level: 3, type: 'account' },
  { code: '9.1.02', name: 'Juros recebidos', level: 3, type: 'account' },

  { code: '9.2', name: 'Despesas Financeiras', level: 2, type: 'subgroup' },
  { code: '9.2.01', name: 'Juros sobre empréstimos e financiamentos', level: 3, type: 'account' },
  { code: '9.2.02', name: 'Multas e encargos financeiros', level: 3, type: 'account' },
  { code: '9.2.03', name: 'Outras despesas financeiras', level: 3, type: 'account' },

  // EBT (calculado)
  { code: 'EBT', name: 'EBT (Resultado antes dos Impostos)', level: 1, type: 'group', isBold: true, isTotal: true },

  // 10.0 Impostos sobre o Lucro
  { code: '10.0', name: 'Impostos sobre o Lucro', level: 1, type: 'group', isBold: true },
  { code: '10.1', name: 'Imposto de Renda Pessoa Jurídica', level: 2, type: 'account' },
  { code: '10.2', name: 'Contribuição Social sobre o Lucro', level: 2, type: 'account' },

  // Lucro Líquido (calculado)
  { code: 'LL', name: 'LUCRO LÍQUIDO', level: 1, type: 'group', isBold: true, isTotal: true },
];

// Mapeamento de códigos calculados
export const CALCULATED_TOTALS = {
  'RL': { // Receita Líquida = 1.0 - 2.0
    add: ['1.0'],
    subtract: ['2.0'],
  },
  'MC': { // Margem de Contribuição = RL - 3.0
    add: ['RL'],
    subtract: ['3.0'],
  },
  'EBITDA': { // EBITDA = MC - 4.0 - 5.0 - 6.0 - 7.0
    add: ['MC'],
    subtract: ['4.0', '5.0', '6.0', '7.0'],
  },
  'EBIT': { // EBIT = EBITDA - 8.0
    add: ['EBITDA'],
    subtract: ['8.0'],
  },
  'EBT': { // EBT = EBIT + 9.1 - 9.2
    add: ['EBIT', '9.1'],
    subtract: ['9.2'],
  },
  'LL': { // Lucro Líquido = EBT - 10.0
    add: ['EBT'],
    subtract: ['10.0'],
  },
};

// Meses em português
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// Função para formatar valor em reais
export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// API function
export async function fetchDREData(filters: DREFilters): Promise<DREResponse> {
  const params = new URLSearchParams({
    year: filters.year.toString(),
    startMonth: filters.startMonth.toString(),
    endMonth: filters.endMonth.toString(),
  });

  const res = await fetch(`/api/admin/finance/reports/dre?${params}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Erro ao buscar dados do DRE');
  }

  return res.json();
}
