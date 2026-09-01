import { z } from 'zod';

// Schemas para dados dentro dos snapshots JSON

export const addressSnapshotSchema = z.object({
  nome: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  documento: z.string().optional(),
  complemento: z.string().optional(),
  id: z.string().optional(),
  apelido: z.string().optional(),
  logradouro: z.string(),
  numero: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
  cep: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const volumeSnapshotSchema = z.object({
  idx: z.number().optional(),
  comprimentoCm: z.number(),
  larguraCm: z.number(),
  alturaCm: z.number(),
  pesoKg: z.number(),
  pesoCubadoKg: z.number().optional(),
});

export const preferencesSnapshotSchema = z.object({
  pickupRequested: z.boolean().optional(),
  reverse: z.boolean().optional(),
  reminder: z.string().optional(),
});

export const selectedQuoteSnapshotSchema = z.object({
  carrier: z.string(),
  serviceCode: z.string().optional(),
  serviceName: z.string(),
  price: z.number(),
  deadlineDays: z.number(),
  source: z.enum(['real', 'error', 'quote']).optional(), // 'real' = API, 'error' = falha, 'quote' = cotação selecionada
});

export const totalsSnapshotSchema = z.object({
  subtotal: z.number().optional(),
  desconto: z.number().optional(),
  taxas: z.number().optional(),
  pickupFee: z.number().optional(),
  total: z.number(),
  moeda: z.string().default('BRL'),
});

export const pickupPointSnapshotSchema = z.object({
  id: z.string(),
  nome: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
}).nullable();

export const pickupFeeSnapshotSchema = z.object({
  collectorId: z.string(),
  feeAmount: z.number(),
  distanceKm: z.number(),
}).nullable();

// Schema para endereço NF-e (para espelho)
const nfeEnderecoSchema = z.object({
  logradouro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  pais: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
}).nullable().optional();

// Schema para impostos de item NF-e
const nfeImpostosItemSchema = z.object({
  icms: z.object({
    cst: z.string().nullable().optional(),
    baseCalculo: z.number().nullable().optional(),
    aliquota: z.number().nullable().optional(),
    valor: z.number().nullable().optional(),
  }).nullable().optional(),
  ipi: z.object({
    cst: z.string().nullable().optional(),
    baseCalculo: z.number().nullable().optional(),
    aliquota: z.number().nullable().optional(),
    valor: z.number().nullable().optional(),
  }).nullable().optional(),
  pis: z.object({
    cst: z.string().nullable().optional(),
    baseCalculo: z.number().nullable().optional(),
    aliquota: z.number().nullable().optional(),
    valor: z.number().nullable().optional(),
  }).nullable().optional(),
  cofins: z.object({
    cst: z.string().nullable().optional(),
    baseCalculo: z.number().nullable().optional(),
    aliquota: z.number().nullable().optional(),
    valor: z.number().nullable().optional(),
  }).nullable().optional(),
}).nullable().optional();

// Schema para dados completos da NF-e (para espelho)
const nfeDataSchema = z.object({
  chave: z.string(),
  numero: z.string(),
  serie: z.string(),
  valorTotal: z.number(),
  items: z.array(z.object({
    id: z.string(),
    sku: z.string().nullable().optional(),
    descricao: z.string(),
    ncm: z.string().nullable().optional(),
    cfop: z.string().nullable().optional(),
    unidade: z.string().nullable().optional(),
    quantidade: z.number(),
    pesoLiquido: z.number().nullable().optional(),
    valorUnitario: z.number(),
    valorTotal: z.number(),
    impostos: nfeImpostosItemSchema,
  })),
  identificacao: z.object({
    modelo: z.string().nullable().optional(),
    serie: z.string().nullable().optional(),
    numero: z.string().nullable().optional(),
    dataEmissao: z.string().nullable().optional(),
    naturezaOp: z.string().nullable().optional(),
    tipoOperacao: z.string().nullable().optional(),
    ambiente: z.string().nullable().optional(),
  }).nullable().optional(),
  emitente: z.object({
    cnpjCpf: z.string().nullable().optional(),
    ie: z.string().nullable().optional(),
    razaoSocial: z.string().nullable().optional(),
    nomeFantasia: z.string().nullable().optional(),
    endereco: nfeEnderecoSchema,
  }).nullable().optional(),
  destinatario: z.object({
    cnpjCpf: z.string().nullable().optional(),
    ie: z.string().nullable().optional(),
    nome: z.string().nullable().optional(),
    endereco: nfeEnderecoSchema,
  }).nullable().optional(),
  totais: z.object({
    baseCalculoIcms: z.number().nullable().optional(),
    valorIcms: z.number().nullable().optional(),
    valorProdutos: z.number().nullable().optional(),
    valorFrete: z.number().nullable().optional(),
    valorSeguro: z.number().nullable().optional(),
    valorDesconto: z.number().nullable().optional(),
    valorOutros: z.number().nullable().optional(),
    valorIpi: z.number().nullable().optional(),
    valorPis: z.number().nullable().optional(),
    valorCofins: z.number().nullable().optional(),
    valorTotal: z.number().nullable().optional(),
  }).nullable().optional(),
  pagamentos: z.array(z.object({
    forma: z.string().nullable().optional(),
    formaDescricao: z.string().nullable().optional(),
    valor: z.number().nullable().optional(),
  })).nullable().optional(),
  protocolo: z.object({
    numero: z.string().nullable().optional(),
    dataAutorizacao: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    motivo: z.string().nullable().optional(),
  }).nullable().optional(),
}).nullable().optional();

// Schema para documento fiscal (NFE ou Declaração)
// Baseado no mesmo formato do /api/checkout
export const documentSnapshotSchema = z.object({
  type: z.enum(['NFE', 'DECLARACAO']),
  /** Chave da DC-e, quando o documento é declaração de conteúdo. */
  dceKey: z.string().optional(),
  // Novo formato NFE: packages (NF por pacote com items)
  packages: z.array(z.object({
    chave: z.string(),
    xmlId: z.string().nullable().optional(),
    items: z.array(z.object({
      id: z.string(),
      sku: z.string().optional().nullable(),
      descricao: z.string(),
      ncm: z.string().optional().nullable(),
      cfop: z.string().optional().nullable(),
      unidade: z.string().optional().nullable(),
      quantidade: z.number(),
      pesoLiquido: z.number().optional().nullable(),
      valorUnitario: z.number(),
      valorTotal: z.number(),
      impostos: nfeImpostosItemSchema,
    })),
    // Dados completos da NF-e para espelho
    nfeData: nfeDataSchema,
  })).optional(),
  // Formato legado NFE: nfeKeys + nfeItems separados
  nfeKeys: z.array(z.object({ chave: z.string() })).optional(),
  nfeItems: z.array(z.object({
    descricao: z.string(),
    valorUnitario: z.number(),
    valorTotal: z.number().optional(),
    quantidade: z.number(),
  })).optional(),
  // Formato legado DECLARACAO: declarationItems (lista única)
  declarationItems: z.array(z.object({
    id: z.string().optional(),
    descricao: z.string(),
    valorUnitario: z.number(),
    quantidade: z.number(),
  })).optional(),
  // Novo formato DECLARACAO: volumeDeclarations (por volume)
  volumeDeclarations: z.array(z.object({
    volumeIndex: z.number(),
    items: z.array(z.object({
      id: z.string(),
      descricao: z.string(),
      valorUnitario: z.number(),
      quantidade: z.number(),
    })),
  })).optional(),
});

// Schema para adicionar item ao carrinho
export const addCartItemSchema = z.object({
  originAddress: addressSnapshotSchema,
  destination: addressSnapshotSchema,
  volumes: z.array(volumeSnapshotSchema),
  preferences: preferencesSnapshotSchema,
  insuranceValue: z.number().optional(),
  pickupPoint: pickupPointSnapshotSchema.optional(),
  pickupFee: pickupFeeSnapshotSchema.optional(),
  selectedQuote: selectedQuoteSnapshotSchema,
  totals: totalsSnapshotSchema,
  document: documentSnapshotSchema.optional(), // Documento fiscal (NFE/Declaração)
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

// Schema para atualizar item do carrinho
export const updateCartItemSchema = z.object({
  originAddress: addressSnapshotSchema.optional(),
  destination: addressSnapshotSchema.optional(),
  volumes: z.array(volumeSnapshotSchema).optional(),
  preferences: preferencesSnapshotSchema.optional(),
  insuranceValue: z.number().optional(),
  pickupPoint: pickupPointSnapshotSchema.optional(),
  pickupFee: pickupFeeSnapshotSchema.optional(),
  selectedQuote: selectedQuoteSnapshotSchema.optional(),
  totals: totalsSnapshotSchema.optional(),
  document: documentSnapshotSchema.optional(), // Documento fiscal (NFE/Declaração)
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

// Schema para checkout
export const checkoutCartSchema = z.object({
  itemIds: z.array(z.string()).optional(), // Se vazio, usa todos os itens
  paymentMethod: z.enum(['wallet', 'pix', 'card']).optional(), // Método de pagamento escolhido
});

export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;
