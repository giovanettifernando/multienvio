import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from "@/platform/db/db";
import { getUserSessionFromRequest } from "@/modules/auth/application/user-session";

type RecipientDto = {
  id: string;
  userId: string;
  name: string;
  nameSearch: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ImportRecipientsResponse = {
  message: string;
  imported: number;
  errors?: string[];
  data: RecipientDto[];
};

/**
 * POST /api/account/recipients/import
 * Importa destinatários recorrentes a partir de um arquivo CSV
 *
 * Formato esperado do CSV:
 * nome,documento,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,observacoes
 */
export const POST = withApiHandler<ImportRecipientsResponse>(async (context) => {
  const session = await getUserSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401
    });
  }

  const formData = await context.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Arquivo não fornecido',
      status: 400
    });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Arquivo vazio ou sem dados',
      status: 400
    });
  }

  // Verificar header
  const header = lines[0].toLowerCase();
  if (!header.includes("nome") || !header.includes("cep")) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Formato de CSV inválido. O arquivo deve conter as colunas: nome, documento, telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes',
      status: 400
    });
  }

  // Parsear linhas de dados
  const recipients: Array<{
    name: string;
    nameSearch: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    notes: string | null;
    isDefault: boolean;
  }> = [];

  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV com suporte a campos entre aspas
    const values = parseCSVLine(line);

    if (values.length < 11) {
      errors.push(`Linha ${i + 1}: número insuficiente de campos`);
      continue;
    }

    const [
      nome,
      documento,
      telefone,
      email,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      observacoes,
    ] = values;

    // Validar campos obrigatórios
    if (!nome?.trim()) {
      errors.push(`Linha ${i + 1}: nome é obrigatório`);
      continue;
    }

    if (!cep?.trim()) {
      errors.push(`Linha ${i + 1}: CEP é obrigatório`);
      continue;
    }

    const cepClean = cep.replace(/\D/g, "");
    if (cepClean.length !== 8) {
      errors.push(`Linha ${i + 1}: CEP inválido`);
      continue;
    }

    if (!logradouro?.trim()) {
      errors.push(`Linha ${i + 1}: logradouro é obrigatório`);
      continue;
    }

    if (!numero?.trim()) {
      errors.push(`Linha ${i + 1}: número é obrigatório`);
      continue;
    }

    if (!bairro?.trim()) {
      errors.push(`Linha ${i + 1}: bairro é obrigatório`);
      continue;
    }

    if (!cidade?.trim()) {
      errors.push(`Linha ${i + 1}: cidade é obrigatória`);
      continue;
    }

    if (!uf?.trim() || uf.trim().length !== 2) {
      errors.push(`Linha ${i + 1}: UF inválida`);
      continue;
    }

    // Normalizar telefone para E.164 se fornecido
    let phoneNormalized: string | null = null;
    if (telefone?.trim()) {
      const phoneClean = telefone.replace(/\D/g, "");
      if (phoneClean.length === 10 || phoneClean.length === 11) {
        phoneNormalized = `+55${phoneClean}`;
      } else if (phoneClean.length === 12 || phoneClean.length === 13) {
        // Já tem código do país
        phoneNormalized = `+${phoneClean}`;
      }
    }

    // Normalizar documento (remover pontuação)
    let documentNormalized: string | null = null;
    if (documento?.trim()) {
      documentNormalized = documento.replace(/\D/g, "") || null;
    }

    const nameSearch = nome
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

    recipients.push({
      name: nome.trim(),
      nameSearch,
      document: documentNormalized,
      phone: phoneNormalized,
      email: email?.trim()?.toLowerCase() || null,
      cep: cepClean,
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento?.trim() || null,
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim().toUpperCase(),
      notes: observacoes?.trim() || null,
      isDefault: false,
    });
  }

  if (recipients.length === 0) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Nenhum destinatário válido encontrado no arquivo',
      status: 400,
      details: { errors }
    });
  }

  // Inserir destinatários no banco
  const created = await prisma.recipient.createMany({
    data: recipients.map((r) => ({
      ...r,
      userId: session.userId,
    })),
    skipDuplicates: true,
  });

  // Buscar todos os destinatários do usuário para retornar
  const allRecipients = await prisma.recipient.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return {
    data: {
      message: `${created.count} destinatário(s) importado(s) com sucesso`,
      imported: created.count,
      errors: errors.length > 0 ? errors : undefined,
      data: allRecipients.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    }
  };
});

/**
 * Parse uma linha CSV com suporte a campos entre aspas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
