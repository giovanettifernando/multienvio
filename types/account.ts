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
  isPrimary?: boolean;
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
