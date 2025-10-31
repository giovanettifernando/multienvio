import { withApiHandler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { listRecipients, createRecipient, type AccountRecipientDto } from "@/lib/services/account-recipients.service";
import { validateRecipientCreateInput } from "@/lib/validation/recipient";
import {
  enforceRecipientWriteLimit,
  mapRecipientValidationError,
  requireUserId,
} from "@/app/api/account/recipients/helpers";

type QuoteRecipient = {
  id: string;
  nome: string;
  telefone: string | null;
  email?: string | null;
  documento: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes?: string | null;
};

function mapToQuoteRecipient(recipient: AccountRecipientDto): QuoteRecipient {
  return {
    id: recipient.id,
    nome: recipient.name,
    telefone: recipient.phone,
    email: recipient.email,
    documento: recipient.document,
    cep: recipient.cep,
    logradouro: recipient.logradouro,
    numero: recipient.numero,
    complemento: recipient.complemento,
    bairro: recipient.bairro,
    cidade: recipient.cidade,
    uf: recipient.uf,
    observacoes: recipient.notes,
  };
}

export const GET = withApiHandler(async ({ req, logger }) => {
  const userId = await requireUserId(req);
  const search = req.nextUrl.searchParams;
  const cepParam = search.get("cep");
  if (!cepParam) {
    return {
      data: [],
      meta: { tags: ["recipients"] },
    };
  }

  const cepDigits = cepParam.replace(/\\D/g, "");
  const list = await listRecipients(
    userId,
    { cep: cepDigits, page: 1, pageSize: 50 },
    { logger },
  );

  const data = list.items
    .filter((item) => item.cep === cepDigits)
    .map((item) => mapToQuoteRecipient(item));

  return {
    data,
    meta: { tags: ["recipients"] },
  };
});

export const POST = withApiHandler(async (context) => {
  const { req, logger } = context;
  const userId = await requireUserId(req);
  enforceRecipientWriteLimit(context);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw new ApiError({
      code: "invalid_payload",
      message: "JSON inválido.",
      status: 400,
    });
  }

  const mappedPayload = {
    name: (payload as { nome?: string }).nome,
    email: (payload as { email?: string }).email,
    document: (payload as { documento?: string }).documento,
    phone: (payload as { telefone?: string }).telefone,
    notes: (payload as { observacoes?: string }).observacoes,
    cep: (payload as { cep?: string }).cep,
    logradouro: (payload as { logradouro?: string }).logradouro,
    numero: (payload as { numero?: string }).numero,
    complemento: (payload as { complemento?: string }).complemento,
    bairro: (payload as { bairro?: string }).bairro,
    cidade: (payload as { cidade?: string }).cidade,
    uf: (payload as { uf?: string }).uf,
    isDefault: false,
  };

  let normalized;
  try {
    normalized = validateRecipientCreateInput(mappedPayload);
  } catch (error) {
    mapRecipientValidationError(error);
  }

  const created = await createRecipient(userId, normalized!, { logger });
  return {
    data: mapToQuoteRecipient(created),
    status: 201,
    meta: { tags: ["recipients"] },
  };
});
