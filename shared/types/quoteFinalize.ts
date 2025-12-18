import { z } from "zod";
import type { DocumentType } from '@/shared/types/quote';

export const cepRegex = /^\d{5}-\d{3}$/;

const declarationItemSchema = z.object({
  id: z.string(),
  descricao: z.string().optional(),
  valorUnitario: z.number().optional(),
  quantidade: z.number().optional(),
});

export type DeclarationFormItem = z.infer<typeof declarationItemSchema>;

// Schema para endereço NF-e
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

// Schema para item NF-e expandido
const nfeItemExpandedSchema = z.object({
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
});

// Schema para dados completos da NF-e (para espelho)
const nfeDataSchema = z.object({
  chave: z.string(),
  numero: z.string(),
  serie: z.string(),
  valorTotal: z.number(),
  items: z.array(nfeItemExpandedSchema),
  // Dados adicionais para espelho NF-e (todos opcionais)
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

export type NFeDataForm = z.infer<typeof nfeDataSchema>;

// Schema para documento de um volume específico (NF-e ou Declaração)
const volumeDocumentSchema = z.object({
  volumeIndex: z.number(),
  type: z.enum(["NFE", "DECLARACAO"]).nullable(), // null = não definido ainda
  // Campos para NF-e
  nfeKey: z.string().optional(),
  nfeXmlId: z.string().nullable().optional(),
  nfeItems: z.array(z.object({
    id: z.string(),
    sku: z.string().nullable().optional(),
    descricao: z.string(),
    ncm: z.string().nullable().optional(),
    cfop: z.string().nullable().optional(),
    quantidade: z.number(),
    pesoLiquido: z.number().nullable().optional(),
    valorUnitario: z.number(),
    valorTotal: z.number(),
  })).optional(),
  // Dados completos da NF-e para espelho (opcional)
  nfeData: nfeDataSchema.optional(),
  // Campos para Declaração
  declarationItems: z.array(declarationItemSchema).optional(),
});

export type VolumeDocument = z.infer<typeof volumeDocumentSchema>;

// Schema para declaração de conteúdo de um volume específico
const volumeDeclarationSchema = z.object({
  volumeIndex: z.number(),
  items: z.array(declarationItemSchema).optional(),
});

export type VolumeDeclarationForm = z.infer<typeof volumeDeclarationSchema>;

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
// Nota: A validação do formato (44 dígitos) é feita no superRefine/validateVolumeDocumentsOnSubmit
// Aqui apenas garantimos que é uma string opcional para permitir inicialização com string vazia
const packageInvoiceSchema = z.object({
  chave: z.string(), // Validação de formato delegada ao superRefine
  xmlId: z.string().nullable().optional(),
  items: z.array(invoiceItemSchema),
});

export type PackageInvoiceForm = z.infer<typeof packageInvoiceSchema>;

// Schema legado para retrocompatibilidade
// Nota: A validação do formato (44 dígitos) é feita no superRefine
const nfeKeySchema = z.object({
  chave: z.string(), // Validação de formato delegada ao superRefine
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
      // Novo formato: documento por volume (NFE ou Declaração para cada volume)
      volumeDocuments: z.array(volumeDocumentSchema).optional(),
      // Campos legados para retrocompatibilidade
      nfeKey: z.string().optional(),
      nfeXml: z.string().optional().nullable(),
      nfeKeys: z.array(nfeKeySchema).optional(),
      nfeItems: z.array(invoiceItemSchema).optional(),
      // Novo formato: NF por pacote
      packages: z.array(packageInvoiceSchema).optional(),
      // Legado: declaração única (retrocompatibilidade)
      declarationItems: z.array(declarationItemSchema).optional(),
      // Novo formato: declaração por volume
      volumeDeclarations: z.array(volumeDeclarationSchema).optional(),
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
    // Novo formato: volumeDocuments (cada volume pode ter NF-e ou Declaração)
    // Se volumeDocuments está sendo usado, a validação é feita separadamente via validateVolumeDocumentsOnSubmit
    const hasVolumeDocuments = values.document.volumeDocuments && values.document.volumeDocuments.length > 0;

    if (values.document.type === "NFE") {
      // Se usando volumeDocuments, pular validação inline (será validado no submit)
      if (hasVolumeDocuments) {
        // Validação delegada para validateVolumeDocumentsOnSubmit
        return;
      }
      // Validação para NF por pacote (novo formato preferencial)
      else if (values.document.packages && values.document.packages.length > 0) {
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
      // Se usando volumeDocuments, pular validação inline (será validado no submit)
      if (hasVolumeDocuments) {
        // Validação delegada para validateVolumeDocumentsOnSubmit
        return;
      }
      // Validação de declaração de conteúdo removida do modo inline
      // A validação será feita apenas no submit através da função validateDeclarationOnSubmit
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

/**
 * Valida a declaração de conteúdo apenas no momento do submit
 * Retorna um objeto com os erros encontrados
 */
export function validateDeclarationOnSubmit(values: FinalizeFormValues): {
  isValid: boolean;
  errors: Array<{ path: string; message: string; volumeIndex?: number }>;
} {
  const errors: Array<{ path: string; message: string; volumeIndex?: number }> = [];

  if (values.document.type !== "DECLARACAO") {
    return { isValid: true, errors: [] };
  }

  // Novo formato: declaração por volume
  if (values.document.volumeDeclarations && values.document.volumeDeclarations.length > 0) {
    values.document.volumeDeclarations.forEach((volDecl, idx) => {
      // Verificar se há itens
      if (!volDecl.items || volDecl.items.length === 0) {
        errors.push({
          path: `document.volumeDeclarations.${idx}.items`,
          message: `Adicione ao menos um item na declaração do Volume ${idx + 1}.`,
          volumeIndex: idx,
        });
        return;
      }

      // Verificar se há pelo menos um item válido (com descrição preenchida)
      const hasValidItem = volDecl.items.some(item =>
        item.descricao &&
        item.descricao.trim().length >= 3 &&
        (item.valorUnitario ?? 0) > 0 &&
        (item.quantidade ?? 0) > 0
      );

      if (!hasValidItem) {
        errors.push({
          path: `document.volumeDeclarations.${idx}.items.0.descricao`,
          message: `Preencha ao menos um item válido para o Volume ${idx + 1}.`,
          volumeIndex: idx,
        });
      }

      // Validar cada item individualmente
      volDecl.items.forEach((item, itemIdx) => {
        if (item.descricao && item.descricao.trim().length > 0 && item.descricao.trim().length < 3) {
          errors.push({
            path: `document.volumeDeclarations.${idx}.items.${itemIdx}.descricao`,
            message: "Descrição deve ter pelo menos 3 caracteres.",
            volumeIndex: idx,
          });
        }

        if (item.valorUnitario !== undefined && item.valorUnitario !== null && item.valorUnitario <= 0) {
          errors.push({
            path: `document.volumeDeclarations.${idx}.items.${itemIdx}.valorUnitario`,
            message: "Valor deve ser maior que zero.",
            volumeIndex: idx,
          });
        }

        if (item.quantidade !== undefined && item.quantidade !== null && item.quantidade <= 0) {
          errors.push({
            path: `document.volumeDeclarations.${idx}.items.${itemIdx}.quantidade`,
            message: "Quantidade deve ser maior que zero.",
            volumeIndex: idx,
          });
        }
      });
    });
  }
  // Formato legado: declaração única (retrocompatibilidade)
  else if (!values.document.declarationItems?.length) {
    errors.push({
      path: "document.declarationItems",
      message: "Adicione ao menos um item na declaração.",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida os documentos por volume (novo formato)
 * Permite NF-e ou Declaração para cada volume independentemente
 */
export function validateVolumeDocumentsOnSubmit(values: FinalizeFormValues): {
  isValid: boolean;
  errors: Array<{ path: string; message: string; volumeIndex?: number }>;
} {
  const errors: Array<{ path: string; message: string; volumeIndex?: number }> = [];
  const volumeDocuments = values.document.volumeDocuments;

  // Se não há volumeDocuments, usar validação legada
  if (!volumeDocuments || volumeDocuments.length === 0) {
    return { isValid: true, errors: [] };
  }

  volumeDocuments.forEach((vol, idx) => {
    // Verificar se o volume tem um tipo definido
    if (!vol.type) {
      errors.push({
        path: `document.volumeDocuments.${idx}.type`,
        message: `Selecione NF-e ou Declaração para o Volume ${idx + 1}.`,
        volumeIndex: idx,
      });
      return;
    }

    // Validar NF-e
    if (vol.type === "NFE") {
      if (!vol.nfeKey || vol.nfeKey.length !== 44) {
        errors.push({
          path: `document.volumeDocuments.${idx}.nfeKey`,
          message: `Informe a chave da NF-e (44 dígitos) para o Volume ${idx + 1}.`,
          volumeIndex: idx,
        });
      }

      // Validar que itens da NF-e foram carregados do XML
      if (!vol.nfeItems || vol.nfeItems.length === 0) {
        errors.push({
          path: `document.volumeDocuments.${idx}.nfeItems`,
          message: `Erro ao processar XML da NF-e do Volume ${idx + 1}. Tente carregar novamente.`,
          volumeIndex: idx,
        });
      }
    }

    // Validar Declaração
    if (vol.type === "DECLARACAO") {
      if (!vol.declarationItems || vol.declarationItems.length === 0) {
        errors.push({
          path: `document.volumeDocuments.${idx}.declarationItems`,
          message: `Adicione ao menos um item na declaração do Volume ${idx + 1}.`,
          volumeIndex: idx,
        });
        return;
      }

      // Verificar se há pelo menos um item válido
      const hasValidItem = vol.declarationItems.some(
        (item) =>
          item.descricao &&
          item.descricao.trim().length >= 3 &&
          (item.valorUnitario ?? 0) > 0 &&
          (item.quantidade ?? 0) > 0
      );

      if (!hasValidItem) {
        errors.push({
          path: `document.volumeDocuments.${idx}.declarationItems.0.descricao`,
          message: `Preencha ao menos um item válido para o Volume ${idx + 1}.`,
          volumeIndex: idx,
        });
      }

      // Validar cada item
      vol.declarationItems.forEach((item, itemIdx) => {
        if (item.descricao && item.descricao.trim().length > 0 && item.descricao.trim().length < 3) {
          errors.push({
            path: `document.volumeDocuments.${idx}.declarationItems.${itemIdx}.descricao`,
            message: "Descrição deve ter pelo menos 3 caracteres.",
            volumeIndex: idx,
          });
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
