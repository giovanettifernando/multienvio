export type CEP = string;

export type CepLookupResult = {
  cep: CEP;
  valido: boolean;
  cidade?: string;
  uf?: string;
  mensagemErro?: string;
};

export type QuoteVolume = {
  id: string;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  pesoKg: number;
};

export type QuoteFormState = {
  origemCep: CEP;
  origemCidade?: string;
  origemUf?: string;
  origemLabel?: string;
  origemIsDefault?: boolean;
  destinoCep: CEP;
  destinoCidade?: string;
  destinoUf?: string;
  coleta: boolean;
  devolucao: boolean;
  volumes: QuoteVolume[];
  seguroValor?: number | null;
  updatedAt: string;
};

export type PartnerPoint = {
  id: string;
  nome: string;
  distanciaKm: number;
  enderecoCurto?: string;
  parceiro?: boolean;
  mensagem?: string;
};

export type QuoteResultItem = {
  id: string;
  carrier: string;
  modalidade: string;
  prazoDias: number;
  preco: number;
  exigeSeguro?: boolean;
  source?: "real" | "mock"; // Indica se é cotação real ou mockada por falha de integração
};

export type QuoteSummary = {
  origemCep: CEP;
  origemCidade?: string;
  origemUf?: string;
  origemLabel?: string;
  origemIsDefault?: boolean;
  destinoCep: CEP;
  destinoCidade?: string;
  destinoUf?: string;
  volumes: QuoteVolume[];
  seguroValor?: number | null;
  coleta: boolean;
  devolucao: boolean;
};

export type QuoteResultsState = {
  quoteId: string;
  createdAt: string;
  expiresAt: string;
  resumo: QuoteSummary;
  results: QuoteResultItem[];
  pontosParceiros?: PartnerPoint[];
};

export type QuoteRequestPayload = {
  origem: { cep: CEP };
  destino: { cep: CEP };
  volumes: Array<{
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    pesoKg: number;
  }>;
  seguro?: number | null;
  coleta: boolean;
  devolucao: boolean;
};

export type QuoteResponsePayload = QuoteResultItem[];

export type QuoteSelectionPayload = {
  quoteId: string;
  serviceId: string;
  seguro?: number | null;
};

export type QuoteSelectionResponse = {
  selectionId: string;
  exigeDocumento: boolean;
  exigeSeguro: boolean;
};

export type DocumentType = "NFE" | "DECLARACAO";

export type QuoteSelectionState = {
  selectionId: string;
  quoteId: string;
  result: QuoteResultItem;
  exigeDocumento: boolean;
  exigeSeguro: boolean;
  documento?: DocumentType;
  seguroValor?: number | null;
};

export type DeclarationItem = {
  id: string;
  descricao: string;
  valorUnitario: number;
  quantidade: number;
};

export type PostingUnit = {
  id: string;
  nome: string;
  cep: CEP;
  endereco: string;
  cidade: string;
  uf: string;
  parceiro?: boolean;
  distanciaKm?: number;
};

export type Recipient = {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  documento: string;
  cep: CEP;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes?: string;
};

export type RecipientPayload = Omit<Recipient, "id"> & { id?: string };

export type UnitFilters = {
  cep?: CEP;
  ampliarAlcance?: boolean;
  estadosProximos?: boolean;
};

export type QuoteTelemetry = {
  volumesCount: number;
  pesoTotalKg: number;
  pesoCubadoTotalKg: number;
  ordenacao?: "price" | "prazo";
  coleta: boolean;
  devolucao: boolean;
  docType?: DocumentType;
  hasInsuranceValue?: boolean;
};

export type QuoteCalculateResponse = {
  quoteId?: string; // ID retornado pela API (opcional para compatibilidade)
  createdAt?: string;
  expiresAt?: string;
  results: QuoteResultItem[];
  pontosParceiros?: PartnerPoint[];
};
