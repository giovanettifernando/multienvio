import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, Address, Card, PasswordChange, Recipient, RecipientList } from "@/types/account";

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["account", "profile"],
    queryFn: async () => {
      const response = await fetch("/api/account/profile", {
        credentials: 'include', // Send cookies for authentication
      });
      if (!response.ok) {
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error("Sessão expirada");
        }
        throw new Error("Falha ao carregar perfil");
      }
      return (await response.json()) as Profile;
    },
  });
}

export function useProfileSave() {
  const qc = useQueryClient();
  return useMutation<Profile, Error, Profile>({
    mutationFn: async (payload: Profile) => {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        credentials: 'include', // Send cookies for authentication
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error("Sessão expirada");
        }
        throw new Error("Falha ao salvar perfil");
      }
      return (await response.json()) as Profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "profile"] });
    },
  });
}

export function useAddresses() {
  return useQuery<Address[]>({
    queryKey: ["account", "addresses"],
    queryFn: async () => {
      const response = await fetch("/api/account/addresses", {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error("Sessão expirada");
        }
        throw new Error("Falha ao carregar endereços");
      }
      const data = await response.json();
      return data.addresses || [];
    },
  });
}

export function useAddressCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Address>) => {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
        credentials: 'include',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao adicionar endereço");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "addresses"] });
    },
  });
}

export function useAddressUpdate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Address>) => {
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao atualizar endereço");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "addresses"] });
    },
  });
}

export function useAddressDelete(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Falha ao remover endereço");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "addresses"] });
    },
  });
}

type RawCard = Omit<Card, "isDefault"> & {
  isDefault?: boolean;
  isPrimary?: boolean;
};

type CardsApiResponse = {
  data?: {
    items?: RawCard[];
  } | RawCard[];
};

function normalizeCardsPayload(payload: unknown): RawCard[] {
  if (Array.isArray(payload)) {
    return payload as RawCard[];
  }

  if (payload && typeof payload === "object") {
    const data = (payload as CardsApiResponse).data;
    if (Array.isArray(data)) {
      return data as RawCard[];
    }
    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return data.items as RawCard[];
    }
  }

  return [];
}

function mapCardShape(card: RawCard): Card {
  return {
    ...card,
    isDefault: Boolean(card.isDefault ?? card.isPrimary ?? false),
  };
}

async function throwAccountApiError(response: Response, fallback: string): Promise<never> {
  let body: any = null;
  try {
    body = await response.json();
  } catch (error) {
    // ignore JSON parse errors
  }

  const code = body?.error?.code ?? body?.code;
  let message = body?.error?.message ?? body?.mensagem ?? fallback;

  if (code === "invalid_exp_month") {
    message = "Mês inválido (01–12).";
  } else if (code === "invalid_exp_year") {
    message = "Ano inválido.";
  } else if (code === "card_expired") {
    message = "Cartão expirado.";
  } else if (code === "invalid_cpf") {
    message = "CPF inválido.";
  } else if (code === "invalid_cnpj") {
    message = "CNPJ inválido.";
  } else if (code === "invalid_phone") {
    message = "Telefone inválido.";
  } else if (code === "invalid_cep") {
    message = "CEP inválido.";
  } else if (code === "invalid_uf") {
    message = "UF inválida.";
  } else if (code === "duplicate_recipient") {
    message = "Destinatário já cadastrado.";
  }

  throw new Error(message);
}

export function useCards() {
  return useQuery<Card[]>({
    queryKey: ["account", "cards"],
    queryFn: async () => {
      const response = await fetch("/api/account/cards", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Falha ao carregar cartões");
      }
      const json = await response.json();
      return normalizeCardsPayload(json).map(mapCardShape);
    },
  });
}

export function useCardCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const response = await fetch("/api/account/cards", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao adicionar cartão");
      }
      const json = await response.json();
      return json?.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
    },
  });
}

export function useCardUpdate() {
  const qc = useQueryClient();
  return useMutation<Card, Error, { id: string; payload: Partial<Card> }>({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Card> }) => {
      const response = await fetch(`/api/account/cards/${id}`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao atualizar cartão");
      }
      const json = await response.json();
      return json?.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
    },
  });
}

export function useCardDelete() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/account/cards/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao remover cartão");
      }
      const json = await response.json();
      return json?.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
    },
  });
}

type RecipientPayload = {
  name: string;
  email?: string | null;
  document?: string | null;
  phone?: string | null;
  notes?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
};

type RawRecipientList = {
  data?: RecipientList;
} | RecipientList;

function normalizeRecipientListPayload(payload: unknown): RecipientList {
  if (!payload || typeof payload !== "object") {
    throw new Error("Falha ao carregar destinatários");
  }

  const data = (payload as RawRecipientList).data ?? (payload as RecipientList);
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Falha ao carregar destinatários");
  }
  return {
    ...data,
    items: data.items.map(mapRecipientDto),
  };
}

function mapRecipientDto(dto: any): Recipient {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email ?? null,
    document: dto.document ?? null,
    phone: dto.phone ?? null,
    notes: dto.notes ?? null,
    isDefault: Boolean(dto.isDefault),
    cep: dto.cep,
    logradouro: dto.logradouro,
    numero: dto.numero,
    complemento: dto.complemento ?? null,
    bairro: dto.bairro,
    cidade: dto.cidade,
    uf: dto.uf,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

type RecipientListFilters = {
  q?: string;
  city?: string;
  uf?: string;
  page: number;
  pageSize: number;
};

export function useAccountRecipients(filters: RecipientListFilters) {
  return useQuery<RecipientList>({
    queryKey: ["account", "recipients", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));
      if (filters.q) params.set("q", filters.q);
      if (filters.city) params.set("city", filters.city);
      if (filters.uf) params.set("uf", filters.uf);

      const response = await fetch(`/api/account/recipients?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao carregar destinatários");
      }
      const json = await response.json();
      return normalizeRecipientListPayload(json);
    },
    keepPreviousData: true,
  });
}

export function useRecipientCreate() {
  const qc = useQueryClient();
  return useMutation<Recipient, Error, RecipientPayload>({
    mutationFn: async (payload: RecipientPayload) => {
      const response = await fetch("/api/account/recipients", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao adicionar destinatário");
      }
      const json = await response.json();
      const data = json?.data ?? json;
      return mapRecipientDto(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "recipients"] });
    },
  });
}

export function useRecipientUpdate() {
  const qc = useQueryClient();
  return useMutation<Recipient, Error, { id: string; payload: Partial<RecipientPayload> }>({
    mutationFn: async ({ id, payload }) => {
      const response = await fetch(`/api/account/recipients/${id}`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao atualizar destinatário");
      }
      const json = await response.json();
      const data = json?.data ?? json;
      return mapRecipientDto(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "recipients"] });
    },
  });
}

export function useRecipientDelete() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/account/recipients/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao remover destinatário");
      }
      const json = await response.json();
      return json?.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "recipients"] });
    },
  });
}

export function useRecipientMakeDefault() {
  const qc = useQueryClient();
  return useMutation<Recipient, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/account/recipients/${id}/make-default`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        await throwAccountApiError(response, "Falha ao definir destinatário padrão");
      }
      const json = await response.json();
      const data = json?.data ?? json;
      return mapRecipientDto(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "recipients"] });
    },
  });
}

export function usePasswordChange() {
  return useMutation({
    mutationFn: async (payload: PasswordChange) => {
      const response = await fetch("/api/account/password", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao alterar senha");
      }
      return response.json();
    },
  });
}
