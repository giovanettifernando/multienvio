import { z } from "zod";
import type { DocumentType } from "@/types/quote";

export const cepRegex = /^\d{5}-\d{3}$/;

const declarationItemSchema = z.object({
  id: z.string(),
  descricao: z.string().min(3, "Informe a descrição."),
  valorUnitario: z.number().gt(0, "Valor deve ser maior que zero."),
  quantidade: z
    .number()
    .int("Quantidade deve ser inteira.")
    .gt(0, "Quantidade deve ser maior que zero."),
});

export type DeclarationFormItem = z.infer<typeof declarationItemSchema>;

const manualRecipientSchema = z.object({
  nome: z.string().min(3, "Informe o nome completo."),
  telefone: z.string().min(10, "Informe o telefone."),
  email: z
    .union([z.string().email("E-mail inválido."), z.literal(""), z.undefined()])
    .optional(),
  documento: z.string().min(11, "Informe CPF ou CNPJ."),
  cep: z.string().regex(cepRegex, "CEP inválido."),
  logradouro: z.string().min(3, "Informe o logradouro."),
  numero: z.string().min(1, "Informe o número."),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Informe o bairro."),
  cidade: z.string().min(2, "Informe a cidade."),
  uf: z.string().min(2, "Informe a UF.").max(2, "UF deve ter 2 letras."),
  observacoes: z.string().optional(),
  salvarRecorrente: z.boolean(),
});

export type RecipientManualForm = z.infer<typeof manualRecipientSchema>;

const postingUnitSchema = z.object({
  selected: z
    .object({
      id: z.string(),
      nome: z.string(),
      cep: z.string(),
      endereco: z.string(),
      cidade: z.string(),
      uf: z.string(),
    })
    .nullable()
    .refine((value) => value !== null, {
      message: "Selecione uma unidade de postagem.",
    }),
  ampliarBusca: z.boolean(),
  incluirEstadosProximos: z.boolean(),
  definirComoPadrao: z.boolean(),
});

export const finalizeFormSchema = z
  .object({
    document: z.object({
      type: z.enum(["NFE", "DECLARACAO"] as [DocumentType, DocumentType]),
      nfeKey: z.string().optional(),
      nfeXml: z.string().optional().nullable(),
      declarationItems: z.array(declarationItemSchema),
    }),
    postingUnit: postingUnitSchema,
    recipient: z.object({
      mode: z.enum(["manual", "saved"]),
      savedId: z.string().optional(),
      manual: manualRecipientSchema,
    }),
    sender: z.object({
      addressId: z.string().min(1, "Selecione o remetente."),
      acceptedTerms: z
        .boolean()
        .refine((value) => value === true, {
          message: "Confirme que aceita as regras de embarque.",
        }),
    }),
    services: z.object({
      avisoRecebimento: z.boolean(),
    }),
    payment: z.object({
      method: z.enum(["WALLET", "PIX", "CARD", "BOLETO"]).optional(),
    }),
  })
  .superRefine((values, ctx) => {
    if (values.document.type === "NFE") {
      const keyDigits = values.document.nfeKey?.replace(/\D/g, "") ?? "";
      if (!keyDigits && !values.document.nfeXml) {
        ctx.addIssue({
          path: ["document", "nfeKey"],
          code: z.ZodIssueCode.custom,
          message: "Informe a chave da NF-e ou anexe o XML.",
        });
      } else if (keyDigits && keyDigits.length !== 44) {
        ctx.addIssue({
          path: ["document", "nfeKey"],
          code: z.ZodIssueCode.custom,
          message: "A chave da NF-e deve ter 44 dígitos.",
        });
      }
    } else if (values.document.type === "DECLARACAO") {
      if (!values.document.declarationItems.length) {
        ctx.addIssue({
          path: ["document", "declarationItems"],
          code: z.ZodIssueCode.custom,
          message: "Adicione ao menos um item na declaração.",
        });
      }
    }

    if (values.recipient.mode === "saved" && !values.recipient.savedId) {
      ctx.addIssue({
        path: ["recipient", "savedId"],
        code: z.ZodIssueCode.custom,
        message: "Selecione um destinatário salvo.",
      });
    }
  });

export type FinalizeFormValues = z.infer<typeof finalizeFormSchema>;
