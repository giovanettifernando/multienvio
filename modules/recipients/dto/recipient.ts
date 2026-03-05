import { z } from "zod";
import {
  normalizeCNPJ,
  normalizeCPF,
  validateCNPJ,
  validateCPF,
} from "./profile";

const RecipientBaseSchema = z
  .object({
    name: z.string(),
    email: z.string().nullish(),
    document: z.string().nullish(),
    phone: z.string().nullish(),
    notes: z.string().max(280).nullish(),
    isDefault: z.boolean().optional(),
    cep: z.string(),
    logradouro: z.string(),
    numero: z.string(),
    complemento: z.string().nullish(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string(),
  })
  .strip();

const RecipientUpdateSchema = RecipientBaseSchema.partial().strip();

export type NormalizedRecipientCreateInput = {
  name: string;
  nameSearch: string;
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
};

export type NormalizedRecipientUpdateInput = Partial<NormalizedRecipientCreateInput>;

export class RecipientValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_payload"
      | "invalid_cpf"
      | "invalid_cnpj"
      | "invalid_phone"
      | "invalid_cep"
      | "invalid_uf",
  ) {
    super(message);
    this.name = "RecipientValidationError";
  }
}

function collapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  const normalized = collapseSpaces(value);
  if (normalized.length < 2 || normalized.length > 120) {
    throw new RecipientValidationError("Nome inválido (2–120 caracteres).", "invalid_payload");
  }
  return normalized;
}

function buildSearchName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const schema = z.string().email();
  const parsed = schema.safeParse(trimmed);
  if (!parsed.success) {
    throw new RecipientValidationError("E-mail inválido.", "invalid_payload");
  }
  return parsed.data;
}

function normalizeDocument(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11) {
    const normalized = normalizeCPF(digits);
    if (!validateCPF(normalized)) {
      throw new RecipientValidationError("CPF inválido.", "invalid_cpf");
    }
    return normalized;
  }
  if (digits.length === 14) {
    const normalized = normalizeCNPJ(digits);
    if (!validateCNPJ(normalized)) {
      throw new RecipientValidationError("CNPJ inválido.", "invalid_cnpj");
    }
    return normalized;
  }
  throw new RecipientValidationError("Documento inválido.", digits.length < 14 ? "invalid_cpf" : "invalid_cnpj");
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return null;

  if (value.startsWith("+")) {
    const e164 = `+${cleaned}`;
    if (!/^\+55\d{10,11}$/.test(e164)) {
      throw new RecipientValidationError("Telefone inválido.", "invalid_phone");
    }
    return e164;
  }

  if (cleaned.length === 10 || cleaned.length === 11) {
    const e164 = `+55${cleaned}`;
    if (!/^\+55\d{10,11}$/.test(e164)) {
      throw new RecipientValidationError("Telefone inválido.", "invalid_phone");
    }
    return e164;
  }

  throw new RecipientValidationError("Telefone inválido.", "invalid_phone");
}

function normalizeCep(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new RecipientValidationError("CEP inválido.", "invalid_cep");
  }
  return digits;
}

function normalizeUf(value: string) {
  const upper = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) {
    throw new RecipientValidationError("UF inválida.", "invalid_uf");
  }
  return upper;
}

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = collapseSpaces(value);
  return trimmed.length ? trimmed : null;
}

function assertRequiredField(value: string, label: string) {
  if (!value || !value.trim()) {
    throw new RecipientValidationError(`${label} é obrigatório.`, "invalid_payload");
  }
  return collapseSpaces(value);
}

function toCreatePayload(data: z.infer<typeof RecipientBaseSchema>): NormalizedRecipientCreateInput {
  const name = normalizeName(data.name);
  const email = normalizeEmail(data.email);
  const document = normalizeDocument(data.document);
  const phone = normalizePhone(data.phone);
  const notes = normalizeOptional(data.notes);
  const cep = normalizeCep(data.cep);
  const logradouro = assertRequiredField(data.logradouro, "Logradouro");
  const numero = collapseSpaces(data.numero);
  if (!numero) {
    throw new RecipientValidationError("Número inválido.", "invalid_payload");
  }
  const complemento = normalizeOptional(data.complemento);
  const bairro = assertRequiredField(data.bairro, "Bairro");
  const cidade = assertRequiredField(data.cidade, "Cidade");
  const uf = normalizeUf(data.uf);

  return {
    name,
    nameSearch: buildSearchName(name),
    email,
    document,
    phone,
    notes,
    isDefault: Boolean(data.isDefault),
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
  };
}

export function validateRecipientCreateInput(payload: unknown): NormalizedRecipientCreateInput {
  const parsed = RecipientBaseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RecipientValidationError("Dados inválidos.", "invalid_payload");
  }
  return toCreatePayload(parsed.data);
}

export function validateRecipientUpdateInput(payload: unknown): NormalizedRecipientUpdateInput {
  const parsed = RecipientUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RecipientValidationError("Dados inválidos.", "invalid_payload");
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new RecipientValidationError("Nenhum campo informado.", "invalid_payload");
  }

  const result: NormalizedRecipientUpdateInput = {};

  if (parsed.data.name !== undefined) {
    const name = normalizeName(parsed.data.name);
    result.name = name;
    result.nameSearch = buildSearchName(name);
  }

  if (parsed.data.email !== undefined) {
    result.email = normalizeEmail(parsed.data.email) ?? null;
  }

  if (parsed.data.document !== undefined) {
    result.document = normalizeDocument(parsed.data.document) ?? null;
  }

  if (parsed.data.phone !== undefined) {
    result.phone = normalizePhone(parsed.data.phone) ?? null;
  }

  if (parsed.data.notes !== undefined) {
    result.notes = normalizeOptional(parsed.data.notes);
  }

  if (parsed.data.isDefault !== undefined) {
    result.isDefault = Boolean(parsed.data.isDefault);
  }

  if (parsed.data.cep !== undefined) {
    result.cep = normalizeCep(parsed.data.cep);
  }

  if (parsed.data.logradouro !== undefined) {
    result.logradouro = assertRequiredField(parsed.data.logradouro, "Logradouro");
  }

  if (parsed.data.numero !== undefined) {
    const numero = collapseSpaces(parsed.data.numero);
    if (!numero) {
      throw new RecipientValidationError("Número inválido.", "invalid_payload");
    }
    result.numero = numero;
  }

  if (parsed.data.complemento !== undefined) {
    result.complemento = normalizeOptional(parsed.data.complemento);
  }

  if (parsed.data.bairro !== undefined) {
    result.bairro = assertRequiredField(parsed.data.bairro, "Bairro");
  }

  if (parsed.data.cidade !== undefined) {
    result.cidade = assertRequiredField(parsed.data.cidade, "Cidade");
  }

  if (parsed.data.uf !== undefined) {
    result.uf = normalizeUf(parsed.data.uf);
  }

  return result;
}
