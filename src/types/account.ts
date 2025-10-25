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

export type PersonalPF = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  nascimento?: string | null;
};

export type PersonalPJ = {
  cnpj?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  ie?: string | null;
};

export type Profile = {
  pf: PersonalPF;
  pj?: PersonalPJ;
};

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};
