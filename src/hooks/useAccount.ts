import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Profile,
  Address,
  Card,
  PasswordChange,
} from "@/types/account";

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["account", "profile"],
    queryFn: async () => {
      const response = await fetch("/api/account/profile");
      if (!response.ok) {
        throw new Error("Falha ao carregar perfil");
      }
      return (await response.json()) as Profile;
    },
  });
}

export function useProfileSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Profile) => {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao salvar perfil");
      }
      return response.json();
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
      const response = await fetch("/api/account/addresses");
      if (!response.ok) {
        throw new Error("Falha ao carregar endereços");
      }
      return (await response.json()) as Address[];
    },
  });
}

export function useAddressCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Address>) => {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
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

export function useCards() {
  return useQuery<Card[]>({
    queryKey: ["account", "cards"],
    queryFn: async () => {
      const response = await fetch("/api/account/cards");
      if (!response.ok) {
        throw new Error("Falha ao carregar cartões");
      }
      return (await response.json()) as Card[];
    },
  });
}

export function useCardCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const response = await fetch("/api/account/cards", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao adicionar cartão");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
    },
  });
}

export function useCardUpdate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Card>) => {
      const response = await fetch(`/api/account/cards/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Falha ao atualizar cartão");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
    },
  });
}

export function useCardDelete(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/account/cards/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Falha ao remover cartão");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "cards"] });
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
