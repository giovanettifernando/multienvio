import { z } from "zod";
import { CardBrand } from "@prisma/client";
import {
  assertExpirationWindow,
  detectCardBrand,
  isCardExpired,
  isValidCardNumberLength,
  isValidHolderName,
  luhnCheck,
  normalizeCardNumber,
  normalizeHolderName,
  validateCvvFormat,
} from "@/lib/utils/card";
import { AddressSchema } from "@/lib/validation/address";

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

const CardCreateSchema = z.object({
  number: z.string(),
  holderName: z.string(),
  expMonth: z.coerce.number().int(),
  expYear: z.coerce.number().int(),
  cvv: z
    .string()
    .optional()
    .refine((value) => !value || validateCvvFormat(value), {
      message: "CVV inválido",
    }),
  billingAddressId: z.string().uuid().optional(),
  billingAddress: BillingAddressSchema.partial({
    label: true,
    complemento: true,
  }).optional(),
  isDefault: z.boolean().optional(),
});

const CardUpdateSchema = z
  .object({
    holderName: z.string().optional(),
    expMonth: z.coerce.number().int().optional(),
    expYear: z.coerce.number().int().optional(),
    billingAddressId: z.string().uuid().optional().nullable(),
    isDefault: z.boolean().optional(),
  })
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

export type BillingAddressInput = z.infer<typeof BillingAddressSchema>;

export type NormalizedBillingAddress = ReturnType<typeof normalizeBillingAddress>;

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
      | "expired_card",
  ) {
    super(message);
    this.name = "CardValidationError";
  }
}

function normalizeBillingAddress(input: BillingAddressInput) {
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

  const pan = normalizeCardNumber(parsed.data.number);
  if (!isValidCardNumberLength(pan) || !luhnCheck(pan)) {
    throw new CardValidationError("Número de cartão inválido", "invalid_number");
  }

  const holderName = normalizeHolderName(parsed.data.holderName);
  if (!isValidHolderName(holderName)) {
    throw new CardValidationError("Nome do titular inválido", "invalid_holder");
  }

  if (!assertExpirationWindow(parsed.data.expYear, parsed.data.expMonth)) {
    throw new CardValidationError("Cartão expirado ou validade inválida", "expired_card");
  }

  if (parsed.data.cvv && !validateCvvFormat(parsed.data.cvv)) {
    throw new CardValidationError("CVV inválido", "invalid_cvv");
  }

  const brand = detectCardBrand(pan);
  const billingAddress = parsed.data.billingAddress
    ? normalizeBillingAddress(parsed.data.billingAddress)
    : undefined;

  return {
    pan,
    brand,
    holderName,
    expMonth: parsed.data.expMonth,
    expYear: parsed.data.expYear,
    last4: pan.slice(-4),
    billingAddressId: parsed.data.billingAddressId,
    billingAddress,
    requestDefault: parsed.data.isDefault ?? false,
  };
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
    next.expMonth = data.expMonth;
    next.expYear = data.expYear;
  }

  if (data.billingAddressId !== undefined) {
    next.billingAddressId = data.billingAddressId;
  }

  if (data.isDefault !== undefined) {
    next.isDefault = data.isDefault;
  }

  return next;
}
