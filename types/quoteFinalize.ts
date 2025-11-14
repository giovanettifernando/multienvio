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

// Schema para itens da NF-e
const invoiceItemSchema = z.object({
  id: z.string(),
  sku: z.string().nullable().optional(),
  descricao: z.string(),
  ncm: z.string().nullable().optional(),
  cfop: z.string().nullable().optional(),
  quantidade: z.number(),
  pesoLiquido: z.number().nullable().optional(),
  valorUnitario: z.number(),
  valorTotal: z.number(),
});

export type InvoiceFormItem = z.infer<typeof invoiceItemSchema>;

// Schema para NF-e de um pacote específico
const packageInvoiceSchema = z.object({
  chave: z.string().regex(/^\d{44}$/, "A chave deve ter 44 dígitos."),
  xmlId: z.string().nullable().optional(),
  items: z.array(invoiceItemSchema).default([]),
});

export type PackageInvoiceForm = z.infer<typeof packageInvoiceSchema>;

// Schema legado para retrocompatibilidade
const nfeKeySchema = z.object({
  chave: z.string().regex(/^\d{44}$/, "A chave deve ter 44 dígitos."),
});

export type NFeKey = z.infer<typeof nfeKeySchema>;

const manualRecipientSchema = z.object({
  nome: z.string().optional(),
  telefone: z.string().optional(),
  email: z
    .union([z.string().email("E-mail inválido."), z.literal(""), z.undefined()])
    .optional(),
  documento: z.string().optional(),
  cep: z.string(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string(),
  uf: z.string(),
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
    .nullable(),
  ampliarBusca: z.boolean(),
  incluirEstadosProximos: z.boolean(),
  definirComoPadrao: z.boolean(),
});

export const finalizeFormSchema = z
  .object({
    document: z.object({
      type: z.enum(["NFE", "DECLARACAO"] as [DocumentType, DocumentType]),
      // Campos legados para retrocompatibilidade
      nfeKey: z.string().optional(),
      nfeXml: z.string().optional().nullable(),
      nfeKeys: z.array(nfeKeySchema).optional(),
      nfeItems: z.array(invoiceItemSchema).optional(),
      // Novo formato: NF por pacote
      packages: z.array(packageInvoiceSchema).optional(),
      declarationItems: z.array(declarationItemSchema).optional(),
    }),
    postingUnit: postingUnitSchema,
    recipient: z.object({
      mode: z.enum(["manual", "saved"]),
      savedId: z.string().optional(),
      manual: manualRecipientSchema.optional(),
    }),
    sender: z.object({
      addressId: z.string().optional(),
    }),
  })
  .superRefine((values, ctx) => {
    if (values.document.type === "NFE") {
      // Validação para NF por pacote (novo formato preferencial)
      if (values.document.packages && values.document.packages.length > 0) {
        values.document.packages.forEach((pkg, idx) => {
          if (!pkg.chave || !/^\d{44}$/.test(pkg.chave)) {
            ctx.addIssue({
              path: ["document", "packages", idx, "chave"],
              code: z.ZodIssueCode.custom,
              message: "Informe a chave da NF-e com 44 dígitos.",
            });
          }
        });
      }
      // Validação para o array de chaves (formato intermediário - retrocompatibilidade)
      else if (values.document.nfeKeys) {
        const keys = values.document.nfeKeys;
        if (!keys.length) {
          ctx.addIssue({
            path: ["document", "nfeKeys"],
            code: z.ZodIssueCode.custom,
            message: "Adicione ao menos uma chave de NF-e.",
          });
        } else {
          // Validar cada chave individualmente
          keys.forEach((item, idx) => {
            if (!item.chave || !/^\d{44}$/.test(item.chave)) {
              ctx.addIssue({
                path: ["document", "nfeKeys", idx, "chave"],
                code: z.ZodIssueCode.custom,
                message: "Informe a chave da NF-e com 44 dígitos.",
              });
            }
          });
        }
      }
      // Validação legada para campo único (retrocompatibilidade)
      else {
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
      }
    } else if (values.document.type === "DECLARACAO") {
      if (!values.document.declarationItems?.length) {
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

    // Validar destinatário apenas se mode for "manual" e não houver savedId
    if (values.recipient.mode === "manual") {
      const manual = values.recipient.manual;

      // Se não tem manual data, significa que precisa preencher
      if (!manual) {
        ctx.addIssue({
          path: ["recipient", "manual"],
          code: z.ZodIssueCode.custom,
          message: "Preencha os dados do destinatário.",
        });
        return;
      }

      // Validar apenas campos realmente preenchidos (permite CEP-only no /cotacoes)
      // Nome é obrigatório apenas se estiver preenchendo manualmente
      if (manual.nome && manual.nome.length > 0 && manual.nome.length < 3) {
        ctx.addIssue({
          path: ["recipient", "manual", "nome"],
          code: z.ZodIssueCode.custom,
          message: "Nome deve ter pelo menos 3 caracteres.",
        });
      }

      if (manual.telefone && manual.telefone.length > 0 && manual.telefone.length < 10) {
        ctx.addIssue({
          path: ["recipient", "manual", "telefone"],
          code: z.ZodIssueCode.custom,
          message: "Telefone inválido.",
        });
      }

      if (manual.documento && manual.documento.length > 0 && manual.documento.length < 11) {
        ctx.addIssue({
          path: ["recipient", "manual", "documento"],
          code: z.ZodIssueCode.custom,
          message: "Documento inválido.",
        });
      }

      // CEP, cidade e UF são sempre obrigatórios (vêm do /cotacoes)
      if (!manual.cep || !/^\d{5}-\d{3}$/.test(manual.cep)) {
        ctx.addIssue({
          path: ["recipient", "manual", "cep"],
          code: z.ZodIssueCode.custom,
          message: "CEP inválido.",
        });
      }

      if (!manual.cidade || manual.cidade.length < 2) {
        ctx.addIssue({
          path: ["recipient", "manual", "cidade"],
          code: z.ZodIssueCode.custom,
          message: "Informe a cidade.",
        });
      }

      if (!manual.uf || manual.uf.length !== 2) {
        ctx.addIssue({
          path: ["recipient", "manual", "uf"],
          code: z.ZodIssueCode.custom,
          message: "Informe a UF.",
        });
      }
    }
  });

// Factory function to create schema with pickup context
export function createFinalizeFormSchema(pickupAtOrigin: boolean) {
  return finalizeFormSchema.superRefine((values, ctx) => {
    // Validação adicional: unidade de postagem obrigatória apenas se não houver coleta
    if (!pickupAtOrigin && !values.postingUnit.selected) {
      ctx.addIssue({
        path: ["postingUnit", "selected"],
        code: z.ZodIssueCode.custom,
        message: "Selecione uma unidade de postagem.",
      });
    }
  });
}

export type FinalizeFormValues = z.infer<typeof finalizeFormSchema>;
