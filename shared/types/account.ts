export type Address = {
  id: string;
  label: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
};

export type Card = {
  id: string;
  holderName: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  billingAddressId?: string | null;
  createdAt?: string;
  vaultToken?: string; // Pagar.me card_id (card_XXXX) used for saved-card payments
};

export type Recipient = {
  id: string;
  name: string;
  email: string | null;
  document: string | null;
  phone: string | null;
  notes: string | null;
  isDefault: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RecipientList = {
  items: Recipient[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProfileCompany = {
  cnpj: string;
  razaoSocial: string;
};

export type Profile = {
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  hasCompany: boolean;
  company?: ProfileCompany | null;
  avatarDataUrl?: string | null;
};

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};
