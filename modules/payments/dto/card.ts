import { z } from "zod";
import { CardBrand } from "@prisma/client";
import {
  detectCardBrand,
  isCardExpired,
  isValidCardNumberLength,
  isValidHolderName,
  luhnCheck,
  normalizeCardNumber,
  normalizeHolderName,
  validateCvvFormat,
} from "@/shared/utils/card";
import { AddressSchema } from "./address";

const { label, cep, logradouro, numero, complemento, bairro, cidade, uf } = AddressSchema.shape;

const BillingAddressSchema = z.object({
  label,
  cep,
  logradouro,
  numero,
  complemento,
  bairro,
  cidade,
  uf,
});

const CvvSchema = z.string().optional();

const ExpMonthInput = z.union([z.string(), z.number()]).transform((value) => String(value).trim());
const ExpYearInput = z.union([z.string(), z.number()]).transform((value) => String(value).trim());

const SharedCardFields = {
  number: z.string(),
  holderName: z.string(),
  cvv: CvvSchema,
  document: z.string().optional(),
  billingAddressId: z.string().uuid().optional(),
  billingAddress: BillingAddressSchema.partial({
    label: true,
    complemento: true,
  }).optional(),
  isDefault: z.boolean().optional(),
  mpToken: z.string().optional(), // Token do Mercado Pago para vincular cartão
  pagarmeToken: z.string().optional(), // Token do Pagar.me para salvar cartão no vault
};

const CardCreateSeparatedSchema = z
  .object({
    ...SharedCardFields,
    expMonth: ExpMonthInput,
    expYear: ExpYearInput,
    expiry: z.undefined().optional(),
  })
  .strict();

const CardCreateCombinedSchema = z
  .object({
    ...SharedCardFields,
    expiry: z.string().transform((value) => value.trim()),
    expMonth: z.undefined().optional(),
    expYear: z.undefined().optional(),
  })
  .strict();

const CardCreateSchema = z.union([CardCreateSeparatedSchema, CardCreateCombinedSchema]);

const CardUpdateSchema = z
  .object({
    holderName: z.string().optional(),
    expMonth: ExpMonthInput.optional(),
    expYear: ExpYearInput.optional(),
    billingAddressId: z.string().uuid().optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pelo menos um campo deve ser informado para atualização",
      });
    }
    if (
      (data.expMonth !== undefined && data.expYear === undefined) ||
      (data.expMonth === undefined && data.expYear !== undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expMonth"],
        message: "Expiração deve incluir mês e ano",
      });
    }
  });

export type BillingAddressInput = z.input<typeof BillingAddressSchema>;

export type NormalizedBillingAddress = {
  label: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

export type NormalizedCardCreateInput = {
  pan: string;
  brand: CardBrand;
  holderName: string;
  expMonth: number;
  expYear: number;
  last4: string;
  billingAddressId?: string;
  billingAddress?: NormalizedBillingAddress;
  requestDefault: boolean;
  mpToken?: string; // Token do Mercado Pago (opcional, para salvar no MP)
};

export type NormalizedCardUpdateInput = {
  holderName?: string;
  expMonth?: number;
  expYear?: number;
  billingAddressId?: string | null;
  isDefault?: boolean;
};

export class CardValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_payload"
      | "invalid_number"
      | "invalid_holder"
      | "invalid_cvv"
      | "invalid_exp_month"
      | "invalid_exp_year"
      | "card_expired",
  ) {
    super(message);
    this.name = "CardValidationError";
  }
}

type ParsedCreateInput = z.infer<typeof CardCreateSchema>;

function normalizeExpMonth(raw: string): number {
  const sanitized = raw.replace(/\s/g, "");
  if (!/^\d{1,2}$/u.test(sanitized)) {
    throw new CardValidationError("Mês inválido (01–12).", "invalid_exp_month");
  }
  const month = Number.parseInt(sanitized, 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new CardValidationError("Mês inválido (01–12).", "invalid_exp_month");
  }
  return month;
}

function normalizeExpYear(raw: string): number {
  const sanitized = raw.replace(/\s/g, "");
  if (!/^\d{2}$|^\d{4}$/u.test(sanitized)) {
    throw new CardValidationError("Ano inválido.", "invalid_exp_year");
  }
  const numeric = Number.parseInt(sanitized, 10);
  if (!Number.isInteger(numeric)) {
    throw new CardValidationError("Ano inválido.", "invalid_exp_year");
  }
  if (sanitized.length === 2) {
    return 2000 + numeric;
  }
  return numeric;
}

function normalizeSeparatedExpiry(expMonthRaw: string, expYearRaw: string) {
  return {
    expMonth: normalizeExpMonth(expMonthRaw),
    expYear: normalizeExpYear(expYearRaw),
  };
}

function normalizeCombinedExpiry(expiryRaw: string) {
  const sanitized = expiryRaw.replace(/\s/g, "");
  const match = /^(\d{2})\/(\d{2}|\d{4})$/u.exec(sanitized);
  if (!match) {
    throw new CardValidationError("Mês inválido (01–12).", "invalid_exp_month");
  }
  const [, monthPart, yearPart] = match;
  return normalizeSeparatedExpiry(monthPart, yearPart);
}

function normalizeExpiry(data: ParsedCreateInput) {
  if ("expiry" in data && typeof data.expiry === "string") {
    return normalizeCombinedExpiry(data.expiry);
  }
  if ("expMonth" in data && "expYear" in data) {
    return normalizeSeparatedExpiry(data.expMonth as string, data.expYear as string);
  }
  throw new CardValidationError("Dados inválidos", "invalid_payload");
}

function validateExpiryWindow(expMonth: number, expYear: number) {
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const minYear = nowYear - 1;
  const maxYear = nowYear + 15;

  if (expMonth < 1 || expMonth > 12) {
    throw new CardValidationError("Mês inválido (01–12).", "invalid_exp_month");
  }

  if (expYear < minYear || expYear > maxYear) {
    throw new CardValidationError("Ano inválido.", "invalid_exp_year");
  }

  if (isCardExpired(expMonth, expYear, now)) {
    throw new CardValidationError("Cartão expirado.", "card_expired");
  }
}

function normalizeBillingAddress(input: BillingAddressInput): NormalizedBillingAddress {
  const parsed = BillingAddressSchema.parse(input);
  return {
    label: parsed.label ?? null,
    cep: parsed.cep,
    logradouro: parsed.logradouro,
    numero: parsed.numero,
    complemento: parsed.complemento ?? null,
    bairro: parsed.bairro,
    cidade: parsed.cidade,
    uf: parsed.uf,
  };
}

export function validateCardCreateInput(payload: unknown): NormalizedCardCreateInput {
  const parsed = CardCreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CardValidationError("Dados inválidos", "invalid_payload");
  }

  const data = parsed.data;

  if (data.billingAddressId && data.billingAddress) {
    throw new CardValidationError("Dados inválidos", "invalid_payload");
  }

  const { expMonth, expYear } = normalizeExpiry(data);
  validateExpiryWindow(expMonth, expYear);

  if (process.env.NODE_ENV === "development") {
    console.debug("[account.cards] normalized-expiry", {
      expMonth,
      expYear,
    });
  }

  const pan = normalizeCardNumber(data.number);
  if (!isValidCardNumberLength(pan) || !luhnCheck(pan)) {
    throw new CardValidationError("Número de cartão inválido", "invalid_number");
  }

  const holderName = normalizeHolderName(data.holderName);
  if (!isValidHolderName(holderName)) {
    throw new CardValidationError("Nome do titular inválido", "invalid_holder");
  }

  if (data.cvv && !validateCvvFormat(data.cvv)) {
    throw new CardValidationError("CVV inválido", "invalid_cvv");
  }

  const brand = detectCardBrand(pan);
  const billingAddress = data.billingAddress
    ? normalizeBillingAddress(data.billingAddress)
    : undefined;

  return {
    pan,
    brand,
    holderName,
    expMonth,
    expYear,
    last4: pan.slice(-4),
    billingAddressId: data.billingAddressId,
    billingAddress,
    requestDefault: data.isDefault ?? false,
    mpToken: data.mpToken, // Passar token do MP se fornecido
  };
}

/**
 * Meio de pagamento selecionável na UI (Asaas). Espelha o enum aceito por
 * POST /api/payments/asaas/create.
 */
export type PaymentMethodChoice = "pix" | "credit_card" | "boleto";

/** Dados mínimos para exibir/copiar um boleto recém-gerado. */
export interface BoletoResult {
  boletoUrl: string;
  boletoBarcode: string;
}

export function validateCardUpdateInput(payload: unknown): NormalizedCardUpdateInput {
  const parsed = CardUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CardValidationError("Dados inválidos", "invalid_payload");
  }

  const data = parsed.data;
  const next: NormalizedCardUpdateInput = {};

  if (data.holderName !== undefined) {
    const holderName = normalizeHolderName(data.holderName);
    if (!isValidHolderName(holderName)) {
      throw new CardValidationError("Nome do titular inválido", "invalid_holder");
    }
    next.holderName = holderName;
  }

  if (data.expMonth !== undefined && data.expYear !== undefined) {
    const { expMonth, expYear } = normalizeSeparatedExpiry(data.expMonth, data.expYear);
    validateExpiryWindow(expMonth, expYear);
    next.expMonth = expMonth;
    next.expYear = expYear;
  }

  if (data.billingAddressId !== undefined) {
    next.billingAddressId = data.billingAddressId;
  }

  if (data.isDefault !== undefined) {
    next.isDefault = data.isDefault;
  }

  return next;
}
